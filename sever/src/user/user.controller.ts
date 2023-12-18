import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register';
import { EmailService } from 'src/email/email.service';
import { RedisService } from 'src/redis/redis.service';
import { loginDto } from './dto/login';
import { LoginUserVo } from './vo/login-user.vo';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {

  }
  @Inject(EmailService)
  private emailService: EmailService;
  @Inject(RedisService)
  private redisService: RedisService;
  @Get('register-captcha')
  async captcha(@Query('email') email: string) {
    // 生成验证码
    const code = Math.random().toString().slice(2,8);

    // 设置redis
    await this.redisService.set(`captcha_${email}`, code, 60 * 5);

    // 发送邮件
    await this.emailService.sendMail({
      to: email,
      subject: '验证码',
      html: `<h1>${code}</h1>`
    });

    return '发送成功!';
  }

  @Post('register')
  async register(@Body() registerUser: RegisterUserDto) {
    return await this.userService.register(registerUser)
  }

  // 初始化数据
  @Get("init-data") 
  async initData() {
    await this.userService.initData();
    return 'done';
  }

  @Post('login')
  async login(@Body() loginUser: loginDto) {
    return this.userService.login(loginUser, false);
  } 

  @Post('admin/login')
  async adminLogin(@Body() loginUser: loginDto) {
    return this.userService.login(loginUser, true);
  }

  @Get('refresh-token')
  async refreshToken(@Query('refreshToken') refreshToken: string) {
    return this.userService.refreshToken(refreshToken, false);
  }

  @Get('admin/refresh-token')
  async adminRefreshToken(@Query('refreshToken') refreshToken: string) {
    return this.userService.refreshToken(refreshToken, true);
  }
}
