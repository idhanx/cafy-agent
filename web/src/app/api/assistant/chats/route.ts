import { careerOpsRoot } from "@/lib/career-ops";
import { ChatError, listChats, readChat, saveChat, deleteChat } from "@/lib/assistant-chat-store.mjs";
import { MAX_CHAT_BYTES } from "@/lib/assistant-history.mjs";
import { hostedSync } from "@/lib/hosted-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  return Response.json({ error: error instanceof ChatError ? error.message : "Could not access conversation history" }, { status: error instanceof ChatError ? error.status : 500 });
}
async function GET_handler(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json(listChats(careerOpsRoot()));
    const chat = readChat(careerOpsRoot(), id);
    return chat ? Response.json(chat) : Response.json({ error: "Conversation not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
async function PUT_handler(req: Request) {
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_CHAT_BYTES + 1000) throw new ChatError("Conversation is too large to save", 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new ChatError("Invalid JSON"); }
    return Response.json(saveChat(careerOpsRoot(), body?.id, body));
  } catch (error) { return failure(error); }
}
async function DELETE_handler(req: Request) {
  try {
    const url = new URL(req.url);
    deleteChat(careerOpsRoot(), url.searchParams.get("id"), Number(url.searchParams.get("revision")));
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

export const GET = hostedSync(GET_handler);
export const PUT = hostedSync(PUT_handler);
export const DELETE = hostedSync(DELETE_handler);
