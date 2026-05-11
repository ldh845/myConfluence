import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

// FR-070 (Cycle 16-1a) — Attachments 패턴과 동일하게 두 prefix(pages/.../comments
// + comments/:id)를 한 컨트롤러에서 처리. @Controller() 빈 prefix.
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post('pages/:pageId/comments')
  create(
    @Param('pageId') pageId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(pageId, dto);
  }

  @Get('pages/:pageId/comments')
  listByPage(@Param('pageId') pageId: string) {
    return this.comments.listByPage(pageId);
  }

  @Patch('comments/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.comments.update(id, dto);
  }

  @Delete('comments/:id')
  remove(@Param('id') id: string) {
    return this.comments.remove(id);
  }
}
