import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { Public } from './common/decorators/public.decorator';
import { RateLimit } from './rate-limit/decorators/rate-limit.decorator';

@ApiTags('api')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version('1')
  @Public()
  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({
    status: 200,
    description: 'Returns a hello message',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  @RateLimit({
    capacity: 100,
    refillRate: 10, // 10 requests per second
    windowSeconds: 60,
    strategy: 'token_bucket',
  })
  getHello(): { message: string } {
    return this.appService.getHello();
  }

  @Get('protected')
  @Version(['1', '2'])
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get protected resource' })
  @ApiResponse({
    status: 200,
    description: 'Returns protected data',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'This is a protected endpoint' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
