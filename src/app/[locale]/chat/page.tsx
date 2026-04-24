import { ChatView } from "@/components/chat/chat-view";

type PageProps = {
  params: { locale: string };
};

export default function ChatPage({ params }: PageProps) {
  return <ChatView locale={params.locale} />;
}
