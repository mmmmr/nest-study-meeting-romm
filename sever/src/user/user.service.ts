import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { User } from './entities/user'
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/utils/md5';

@Injectable()
export class UserService {

  private logger = new Logger()
  
  @InjectRepository(User)
  private userRepository: Repository<User>

  @Inject(RedisService)
  private redisService: RedisService;
  
  async register(user: RegisterUserDto) {
    console.log(`captcha_${user.email}`);
    
    // 获取验证码
    const captcha = await this.redisService.get(`captcha_${user.email}`);
    
    // 不存在验证码
    if (!captcha) {
      throw new HttpException('验证码已失效!', HttpStatus.BAD_REQUEST)
    }

    // 验证码不对
    if (user.captcha !== captcha) {
      throw new HttpException('验证码不正确!', HttpStatus.BAD_REQUEST)
    }

    // 查找是否已存在
    const foundUser = await this.userRepository.findOneBy({ username: user.username });

    if (foundUser) {
      throw new HttpException('用户名已存在!', HttpStatus.BAD_REQUEST)
    }

    // 合并对象
    const newUser = new User()

    Object.assign(newUser, {
      ...user,
      password: md5(user.password)
    })

    // 存入
    try {
      await this.userRepository.save(newUser)
      return '注册成功!'
    } catch(e) {
      this.logger.error(e, UserService)
      return '注册失败!'
    }
  }

}
