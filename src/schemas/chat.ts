import * as z from "zod";

/** Flexible id: API may use GUID strings or numeric ids as strings. */
const idString = z.string().min(1);

export const chatConversationSchema = z
  .object({
    id: idString,
    title: z.string().optional().nullable(),
    lastMessagePreview: z.string().optional().nullable(),
    updatedAt: z.string().optional().nullable(),
    participantNames: z.array(z.string()).optional(),
    participantUserIds: z.array(z.string()).optional(),
    unreadCount: z.number().optional(),
    groupType: z.string().optional().nullable(),
    requestId: z.string().optional().nullable(),
  })
  .passthrough();

export const chatContactSchema = z.object({
  userId: idString,
  fullName: z.string(),
  role: z.string(),
});

export const chatMessageSchema = z
  .object({
    id: idString,
    conversationId: idString,
    senderId: idString,
    senderName: z.string().optional().nullable(),
    content: z.string(),
    createdAt: z.string().optional().nullable(),
  })
  .passthrough();

export const createChatConversationSchema = z.object({
  participantUserIds: z.array(idString).min(1),
});

export const sendChatMessageSchema = z.object({
  conversationId: idString,
  content: z.string().min(1),
});

export type ChatConversation = z.infer<typeof chatConversationSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatContact = z.infer<typeof chatContactSchema>;
