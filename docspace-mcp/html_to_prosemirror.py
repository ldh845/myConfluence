#!/usr/bin/env python3
"""
HTML → ProseMirror JSON 변환기
DocSpace MCP 서버의 docspace_import_html 도구에서 호출됨

사용법:
  1) stdin: echo "<html>" | python html_to_prosemirror.py
  2) 파일:  python html_to_prosemirror.py input.html output.json
"""

import sys
import json
import re
import os

try:
    from bs4 import BeautifulSoup
except ImportError:
    print(json.dumps({"error": "bs4 not installed"}))
    sys.exit(1)


def parse_inline(element, marks=None):
    """인라인 요소를 ProseMirror 텍스트 노드로 변환"""
    if marks is None:
        marks = []

    nodes = []

    if isinstance(element, str):
        text = element.strip()
        if text:
            node = {"type": "text", "text": text}
            if marks:
                node["marks"] = marks[:]
            nodes.append(node)
        return nodes

    if element.name is None:
        text = str(element).strip()
        if text:
            node = {"type": "text", "text": text}
            if marks:
                node["marks"] = marks[:]
            nodes.append(node)
        return nodes

    tag = element.name.lower()

    if tag in ('strong', 'b'):
        new_marks = marks + [{"type": "bold"}]
        for child in element.children:
            nodes.extend(parse_inline(child, new_marks))
    elif tag in ('em', 'i'):
        new_marks = marks + [{"type": "italic"}]
        for child in element.children:
            nodes.extend(parse_inline(child, new_marks))
    elif tag == 'u':
        new_marks = marks + [{"type": "underline"}]
        for child in element.children:
            nodes.extend(parse_inline(child, new_marks))
    elif tag in ('del', 's', 'strike'):
        new_marks = marks + [{"type": "strike"}]
        for child in element.children:
            nodes.extend(parse_inline(child, new_marks))
    elif tag == 'code':
        text = element.get_text()
        if text.strip():
            node = {"type": "text", "text": text.strip(), "marks": marks + [{"type": "code"}]}
            nodes.append(node)
    elif tag == 'a':
        href = element.get('href', '')
        new_marks = marks + [{"type": "link", "attrs": {"href": href, "target": "_blank"}}]
        for child in element.children:
            nodes.extend(parse_inline(child, new_marks))
    elif tag == 'br':
        nodes.append({"type": "hardBreak"})
    elif tag == 'span':
        for child in element.children:
            nodes.extend(parse_inline(child, marks))
    elif tag == 'img':
        src = element.get('src', '')
        alt = element.get('alt', '')
        if src:
            nodes.append({"type": "image", "attrs": {"src": src, "alt": alt, "title": ""}})
    else:
        for child in element.children:
            nodes.extend(parse_inline(child, marks))

    return [n for n in nodes if not (n.get('type') == 'text' and not n.get('text', '').strip())]


def parse_block(element):
    """블록 요소를 ProseMirror 노드로 변환"""
    if element.name is None:
        text = str(element).strip()
        if text:
            return {"type": "paragraph", "content": [{"type": "text", "text": text}]}
        return None

    tag = element.name.lower()

    if tag in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
        level = int(tag[1])
        inline = parse_inline(element)
        if not inline:
            inline = [{"type": "text", "text": " "}]
        return {"type": "heading", "attrs": {"level": level}, "content": inline}

    if tag == 'p':
        inline = parse_inline(element)
        if not inline:
            inline = [{"type": "text", "text": " "}]
        return {"type": "paragraph", "content": inline}

    if tag == 'ul':
        return parse_list(element, 'bulletList')

    if tag == 'ol':
        return parse_list(element, 'orderedList')

    if tag == 'blockquote':
        blocks = []
        for child in element.children:
            if hasattr(child, 'name') and child.name:
                block = parse_block(child)
                if block:
                    blocks.append(block)
        if not blocks:
            blocks.append({"type": "paragraph", "content": [{"type": "text", "text": " "}]})
        return {"type": "blockquote", "content": blocks}

    if tag == 'pre':
        code_el = element.find('code')
        text = (code_el or element).get_text()
        return {"type": "codeBlock", "content": [{"type": "text", "text": text or " "}]}

    if tag == 'table':
        return parse_table(element)

    if tag == 'hr':
        return {"type": "horizontalRule"}

    # 기타 블록 — 자식 처리
    blocks = []
    for child in element.children:
        if hasattr(child, 'name') and child.name:
            block = parse_block(child)
            if block:
                blocks.append(block)
    return blocks if blocks else None


def parse_list(element, list_type):
    items = []
    for li in element.find_all('li', recursive=False):
        item_content = []

        for p in li.find_all('p', recursive=False):
            inline = parse_inline(p)
            if inline:
                item_content.append({"type": "paragraph", "content": inline})

        for child in li.children:
            if hasattr(child, 'name'):
                if child.name == 'p':
                    continue
                elif child.name in ('ul', 'ol'):
                    nested = parse_list(child, 'bulletList' if child.name == 'ul' else 'orderedList')
                    if nested:
                        item_content.append(nested)
                elif child.name == 'table':
                    tbl = parse_table(child)
                    if tbl:
                        item_content.append(tbl)
                else:
                    inline = parse_inline(child)
                    if inline:
                        item_content.append({"type": "paragraph", "content": inline})
            elif str(child).strip():
                inline = parse_inline(child)
                if inline:
                    item_content.append({"type": "paragraph", "content": inline})

        if not item_content:
            item_content.append({"type": "paragraph", "content": [{"type": "text", "text": " "}]})
        items.append({"type": "listItem", "content": item_content})

    return {"type": list_type, "content": items} if items else None


def parse_table(table_el):
    rows = []
    tbody = table_el.find('tbody')
    container = tbody if tbody else table_el

    for tr in container.find_all('tr', recursive=False):
        cells = []
        for cell in tr.find_all(['td', 'th'], recursive=False):
            is_header = cell.name == 'th'
            colspan = int(cell.get('colspan', 1))
            rowspan = int(cell.get('rowspan', 1))

            style = cell.get('style', '')
            va_match = re.search(r'vertical-align\s*:\s*(\w+)', style)
            vertical_align = va_match.group(1) if va_match else 'top'

            cell_blocks = []
            for child in cell.children:
                if hasattr(child, 'name') and child.name:
                    if child.name == 'p':
                        inline = parse_inline(child)
                        if inline:
                            cell_blocks.append({"type": "paragraph", "content": inline})
                    elif child.name in ('ul', 'ol'):
                        lst = parse_list(child, 'bulletList' if child.name == 'ul' else 'orderedList')
                        if lst:
                            cell_blocks.append(lst)
                    elif child.name == 'table':
                        tbl = parse_table(child)
                        if tbl:
                            cell_blocks.append(tbl)
                    elif child.name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                        block = parse_block(child)
                        if block:
                            cell_blocks.append(block)
                    else:
                        inline = parse_inline(child)
                        if inline:
                            cell_blocks.append({"type": "paragraph", "content": inline})
                elif str(child).strip():
                    inline = parse_inline(child)
                    if inline:
                        cell_blocks.append({"type": "paragraph", "content": inline})

            if not cell_blocks:
                cell_blocks.append({"type": "paragraph", "content": [{"type": "text", "text": " "}]})

            cells.append({
                "type": "tableHeader" if is_header else "tableCell",
                "attrs": {"colspan": colspan, "rowspan": rowspan, "colwidth": None, "verticalAlign": vertical_align},
                "content": cell_blocks,
            })

        if cells:
            rows.append({"type": "tableRow", "content": cells})

    return {"type": "table", "content": rows} if rows else None


def html_to_prosemirror(html):
    """HTML 문자열을 ProseMirror JSON으로 변환"""
    soup = BeautifulSoup(html, "html.parser")

    # Confluence 특수 태그 제거
    for tag in soup.find_all(['ac:structured-macro', 'ac:image', 'ac:plain-text-body', 'ac:parameter']):
        tag.decompose()
    for tag in soup.find_all('ri:attachment'):
        tag.decompose()

    doc = {"type": "doc", "content": []}
    for child in soup.children:
        if hasattr(child, 'name') and child.name:
            result = parse_block(child)
            if result:
                if isinstance(result, list):
                    doc["content"].extend(result)
                else:
                    doc["content"].append(result)

    if not doc["content"]:
        doc["content"].append({"type": "paragraph", "content": [{"type": "text", "text": " "}]})

    return doc


def main():
    # 인자 확인: 파일 모드 vs stdin 모드
    if len(sys.argv) >= 3:
        # 파일 모드: python script.py input.html output.json
        input_path = sys.argv[1]
        output_path = sys.argv[2]

        with open(input_path, "r", encoding="utf-8") as f:
            html = f.read()

        if not html.strip():
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(json.dumps({"error": "빈 HTML 입력"}))
            sys.exit(1)

        result = html_to_prosemirror(html)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json.dumps(result, ensure_ascii=False))

        print("OK", file=sys.stderr)
    else:
        # stdin 모드: echo "<html>" | python script.py
        html = sys.stdin.read()
        if not html.strip():
            print(json.dumps({"error": "빈 HTML 입력"}))
            sys.exit(1)

        result = html_to_prosemirror(html)
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()