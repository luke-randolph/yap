import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { FriendsModule } from '../friends/friends.module';
import { GifsModule } from '../gifs/gifs.module';
import { MessagesService } from '../messages/messages.service';
import { StorageModule } from '../storage/storage.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [AuthModule, StorageModule, EmailModule, FriendsModule, GifsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, MessagesService],
  exports: [ConversationsService, MessagesService],
})
export class ConversationsModule {}
