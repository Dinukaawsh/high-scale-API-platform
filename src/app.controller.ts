import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { Public } from './common/decorators/public.decorator';
import { RateLimit } from './rate-limit/decorators/rate-limit.decorator';
import { ApiVersion } from './versioning/decorators/api-version.decorator';

@Controller()
@ApiVersion('v1')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  @RateLimit({
    capacity: 100,
    refillRate: 10, // 10 requests per second
    windowSeconds: 60,
    strategy: 'token_bucket',
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('protected')
  @UseGuards(JwtAuthGuard)
  @ApiVersion('v1', 'v2')
  @RateLimit({
    capacity: 50,
    refillRate: 5,
    windowSeconds: 60,
    strategy: 'token_bucket',
  })
  getProtected() {
    return {
      message: 'This is a protected endpoint',
      timestamp: new Date().toISOString(),
    };
  }
}
