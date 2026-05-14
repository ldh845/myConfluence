import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';

@Controller('spaces')
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  // Cycle 32 — 인증 시 본인 개인 공간도 포함, 비인증이면 SITE만.
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@Req() req: Request) {
    return this.spaces.findAll(req.user?.id ?? null);
  }

  // Cycle 32 — 개인 공간 lazy 생성/조회. /spaces/:id 보다 위에 선언.
  @Get('personal')
  @UseGuards(JwtAuthGuard)
  personal(@Req() req: Request) {
    return this.spaces.getOrCreatePersonal({
      id: req.user!.id,
      name: req.user!.name,
    });
  }

  @Post()
  create(@Body() dto: CreateSpaceDto) {
    return this.spaces.create(dto);
  }
}
