import {
  REQUEST_CHAT_GROUP_TYPES,
} from "@/actions/chat/chatApi.contract";
import { isChatStaffRole } from "@/lib/role-utils";
import type { ChatContact, ChatConversation } from "@/schemas/chat";

const END_USER_CONVERSATION_GROUP_TYPES = new Set<string>([
  REQUEST_CHAT_GROUP_TYPES.ownerLeader,
  REQUEST_CHAT_GROUP_TYPES.ownerReception,
]);

function normalizeUserId(userId: string): string {
  return userId.trim().toLowerCase();
}

export function filterContactsForEndUser(contacts: ChatContact[]): ChatContact[] {
  return contacts.filter((contact) => isChatStaffRole(contact.role));
}

export function filterConversationsForEndUser(
  conversations: ChatConversation[],
  currentUserId: string,
  contacts: ChatContact[],
): ChatConversation[] {
  const roleByUserId = new Map(
    contacts.map((contact) => [
      normalizeUserId(contact.userId),
      contact.role,
    ]),
  );
  const normalizedSelf = normalizeUserId(currentUserId);

  return conversations.filter((conversation) => {
    const groupType = conversation.groupType?.trim();
    if (groupType) {
      return END_USER_CONVERSATION_GROUP_TYPES.has(groupType);
    }

    const otherParticipantIds = (conversation.participantUserIds ?? []).filter(
      (id) => id && normalizeUserId(id) !== normalizedSelf,
    );

    if (otherParticipantIds.length === 0) {
      return false;
    }

    return otherParticipantIds.every((id) => {
      const role = roleByUserId.get(normalizeUserId(id));
      return role != null && isChatStaffRole(role);
    });
  });
}
