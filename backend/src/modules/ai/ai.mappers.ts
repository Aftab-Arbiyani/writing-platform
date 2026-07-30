import type { AiConversation } from './conversations/entities/ai-conversation.entity';
import type { AiMessage } from './conversations/entities/ai-message.entity';
import {
  AiConversationDetailDto,
  AiConversationSummaryDto,
  AiMessageDto,
} from './dto/ai-response.dto';

/** Entity → response-DTO mappers (AF1) — the single place row shapes become wire shapes. */

export function toMessageDto(message: AiMessage): AiMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    usage:
      message.totalTokens !== null
        ? {
            inputTokens: message.inputTokens ?? 0,
            outputTokens: message.outputTokens ?? 0,
            totalTokens: message.totalTokens,
          }
        : null,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toConversationSummary(conversation: AiConversation): AiConversationSummaryDto {
  return {
    id: conversation.id,
    title: conversation.title,
    feature: conversation.feature,
    status: conversation.status,
    messageCount: conversation.messageCount,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

export function toConversationDetail(
  conversation: AiConversation,
  messages: AiMessage[],
): AiConversationDetailDto {
  return {
    ...toConversationSummary(conversation),
    messages: messages.map(toMessageDto),
  };
}
