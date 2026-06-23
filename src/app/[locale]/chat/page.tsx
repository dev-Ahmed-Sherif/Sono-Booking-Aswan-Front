import { ChatPageClient } from "@/components/chat/chat-page-client";



type PageProps = {

  params: { locale: string };

};



export default function ChatPage({ params }: PageProps) {

  return <ChatPageClient locale={params.locale} />;

}

