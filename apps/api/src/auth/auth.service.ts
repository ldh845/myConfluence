import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

// FR-001 / FR-002 (Cycle 27a) — 자체 인증.
// 첫 가입자만 자동 ADMIN, 이후는 DEVELOPER. bcrypt salt rounds 10.
// JWT payload: { sub, username, role }. 응답에서 passwordHash는 항상 제외.

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  department: string;
  role: string;
  createdAt: Date;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sanitize(user: {
    id: string;
    username: string;
    name: string;
    department: string;
    role: string;
    createdAt: Date;
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      department: user.department,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async signup(dto: SignupDto): Promise<{ user: AuthUser; token: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing) {
      throw new ConflictException({ error: 'username already exists' });
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userCount = await this.prisma.user.count();
    const role = userCount === 0 ? 'ADMIN' : 'DEVELOPER';
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        department: dto.department,
        role,
      },
    });
    const token = this.signToken(user);
    return { user: this.sanitize(user), token };
  }

  async login(dto: LoginDto): Promise<{ user: AuthUser; token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (!user) {
      throw new UnauthorizedException({ error: 'invalid credentials' });
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ error: 'invalid credentials' });
    }
    const token = this.signToken(user);
    return { user: this.sanitize(user), token };
  }

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.sanitize(user) : null;
  }

  private signToken(user: {
    id: string;
    username: string;
    role: string;
  }): string {
    return this.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });
  }
}
