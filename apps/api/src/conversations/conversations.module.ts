import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagesService } from '../messages/messages.service';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [AuthModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, MessagesService],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule {}
