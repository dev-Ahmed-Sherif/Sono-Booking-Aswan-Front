import * as z from "zod";

const idString = z.string().min(1);

export const notificationSchema = z
  .object({
    id: idString,
    type: z.string(),
    content: z.string(),
    referenceId: z.string().optional().nullable(),
    groupType: z.string().optional().nullable(),
    groupNameAr: z.string().optional().nullable(),
    groupNameEn: z.string().optional().nullable(),
    senderId: idString,
    senderName: z.string().optional().nullable(),
    isRead: z.boolean(),
    createdAt: z.string().optional().nullable(),
  })
  .passthrough();

export type AppNotification = z.infer<typeof notificationSchema>;
