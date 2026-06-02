import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
} from '@nestjs/common';
import { DiagramsService } from './diagrams.service';
import { UpdateDiagramDto } from './dto/update-diagram.dto';

@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagrams: DiagramsService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diagrams.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDiagramDto) {
    return this.diagrams.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.diagrams.remove(id);
  }
}
