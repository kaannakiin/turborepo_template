import { Module } from "@nestjs/common";
import { VerifyController } from "./controllers/verify.controller";
import { VerifyService } from "./services/verify.service";

// No `imports`: PrismaModule and ConfigModule are both @Global(), and this
// feature reaches nothing inside IdentityModule — the principal it acts on is
// already attached to the request by the global JwtAuthGuard.
@Module({
  controllers: [VerifyController],
  providers: [VerifyService],
})
export class VerificationModule {}
