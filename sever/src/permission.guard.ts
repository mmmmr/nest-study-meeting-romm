import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class PermissionGuard implements CanActivate {

  @Inject()
  private readonly reflector: Reflector;

  @Inject()

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {

    const request: Request = context.switchToHttp().getRequest();

    if(!request.user) {
      return true;
    }
    
    const permissionCode = this.reflector.getAllAndOverride<string[]>('permission', [
      context.getClass(),
      context.getHandler()
    ])
    console.log(permissionCode);
    

    if (!permissionCode) {
      return true;
    }
    

    const userPermissions = request.user.permissions.map(p => p.code)

    const flag = userPermissions.find(item => {
      return permissionCode.find(it => it === item)
    })

    if (!flag) {
      throw new UnauthorizedException('您没有访问该接口的权限');
    }
    
    return true

  }
}
