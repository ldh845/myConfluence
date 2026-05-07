import { Body, Controller, Get, Post } from '@nestjs/common';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Get()
  findAll() {
    return this.spaces.findAll();
  }

  @Post()
  create(@Body() dto: CreateSpaceDto) {
    return this.spaces.create(dto);
  }
}
