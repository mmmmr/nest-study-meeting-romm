import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { User } from './entities/user'
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register';
import { RedisService } from 'src/redis/redis.service';
import { md5 } from 'src/utils/md5';
import { Role } from './entities/role';
import { Permission } from './entities/permission';
import { loginDto } from './dto/login';
import { LoginUserVo } from './vo/login-user.vo';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UserService {

  private logger = new Logger()
  
  @InjectRepository(User)
  private userRepository: Repository<User>

  @InjectRepository(Role)
  private roleRepository: Repository<Role>

  @InjectRepository(Permission)
  private permissionRepository: Repository<Permission>

  @Inject(RedisService)
  private redisService: RedisService;
  
  async register(user: RegisterUserDto) {
    
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
    const vo = new User()

    Object.assign(vo, {
      ...user,
      password: md5(user.password)
    })

    // 存入
    try {
      await this.userRepository.save(vo)
      return '注册成功!'
    } catch(e) {
      this.logger.error(e, UserService)
      return '注册失败!'
    }
  }

  async initData() {
    const user1 = new User();
    user1.username = "zhangsan";
    user1.password = md5("111111");
    user1.email = "xxx@xx.com";
    user1.isAdmin = true;
    user1.nickName = '张三';
    user1.phoneNumber = '13233323333';

    const user2 = new User();
    user2.username = 'lisi';
    user2.password = md5("222222");
    user2.email = "yy@yy.com";
    user2.nickName = '李四';

    const role1 = new Role();
    role1.name = '管理员';

    const role2 = new Role();
    role2.name = '普通用户';

    const permission1 = new Permission();
    permission1.code = 'ccc';
    permission1.description = '访问 ccc 接口';

    const permission2 = new Permission();
    permission2.code = 'ddd';
    permission2.description = '访问 ddd 接口';

    user1.roles = [role1];
    user2.roles = [role2];

    role1.permissions = [permission1, permission2];
    role2.permissions = [permission1];

    await this.permissionRepository.save([permission1, permission2]);
    await this.roleRepository.save([role1, role2]);
    await this.userRepository.save([user1, user2]);
  }

  @Inject(JwtService)
  private jwtService: JwtService;

  @Inject(ConfigService)
  private configService: ConfigService;


  // 合并对象
  async getUserVo(user: User, isAdmin: boolean) {
    // 合并对象
    const vo = new LoginUserVo();
    Object.assign(vo, {
      userInfo: user,
    })
    
    const roles = user.roles.map(role => role.name);
    const permissions = user.roles.reduce((acc, cur) => {
      const newArr = cur.permissions.map(permission => permission)
      return Array.from(new Set(acc.concat(newArr)))
    }, [])

    vo.userInfo.roles = roles;
    vo.userInfo.permissions = permissions;

    // 生成token
    vo.accessToken = await this.jwtService.signAsync({
      id: user.id,
      username: user.username,
      roles: vo.userInfo.roles,
      permissions: vo.userInfo.permissions,
      isAdmin
    }, { expiresIn: this.configService.get('jwt_access_token_expires_time') || '30m' });

    vo.refreshToken = await this.jwtService.signAsync({
      id: user.id,
    }, { expiresIn: this.configService.get('jwt_refresh_token_expires_time') || '7d' });
    return vo
  }

  async login(loginUser: loginDto, isAdmin: boolean) {
    // 查询用户
    const user = await this.userRepository.findOne({
      where: {
        username: loginUser.username,
        isAdmin
      },
      relations: ['roles', 'roles.permissions']
    });
    
    if (!user) {
      throw new HttpException('用户名不存在!', HttpStatus.BAD_REQUEST)
    }

    if (user.password !== md5(loginUser.password)) {
      throw new HttpException('密码不正确!', HttpStatus.BAD_REQUEST)
    }
 
    const vo = await this.getUserVo(user, isAdmin);  

    return vo;
  }

  async refreshToken(refreshToken: string, isAdmin: boolean) {
    const token = refreshToken
    try {
      const { id } = this.jwtService.verify(token);
      const user = await this.userRepository.findOne({
        where: {
          id,
          isAdmin
        },
        relations: ['roles', 'roles.permissions']
      });
      
      if (!user) {
        throw new HttpException('用户不存在!', HttpStatus.BAD_REQUEST)
      }
      const vo = await this.getUserVo(user, isAdmin);
      
      return {
        accessToken: vo.accessToken,
        refreshToken: vo.refreshToken
      };
    } catch(e) {
      throw new HttpException('refreshToken已过期!', HttpStatus.BAD_REQUEST)
    }
  }
}
