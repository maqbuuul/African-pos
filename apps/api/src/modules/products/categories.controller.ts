import { Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard.js'
import { RequirePermission } from '../../core/permissions/require-permission.decorator.js'
import { ValidatedBody } from '../../core/validation/validated-body.decorator.js'
import { CategoriesService } from './categories.service.js'
import { CreateCategoryDto } from './dto/create-category.dto.js'
import { UpdateCategoryDto } from './dto/update-category.dto.js'

@Controller('api/v1/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(@Inject(CategoriesService) private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@Req() req: Request, @Query('locationId') locationId?: string) {
    return this.categoriesService.list(req.authContext!, locationId)
  }

  @Post()
  @RequirePermission('products:manage')
  create(@ValidatedBody(CreateCategoryDto) dto: CreateCategoryDto, @Req() req: Request) {
    return this.categoriesService.create(req.authContext!, dto)
  }

  @Patch(':id')
  @RequirePermission('products:manage')
  update(@Param('id') id: string, @ValidatedBody(UpdateCategoryDto) dto: UpdateCategoryDto, @Req() req: Request) {
    return this.categoriesService.update(req.authContext!, id, dto)
  }
}
