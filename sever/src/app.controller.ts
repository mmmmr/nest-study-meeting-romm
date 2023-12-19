import { Controller, Get, SetMetadata } from '@nestjs/common';
import { AppService } from './app.service';
import { RequireLogin, RequirePermission } from './custom.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @RequireLogin()
  @RequirePermission('ddd')
  getHello(): string {
    return this.appService.getHello();
  }
}
