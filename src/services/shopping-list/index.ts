import { kv } from "@vercel/kv";

const KEY = "shopping:list";

export const getItems = async () => {
  const items = await kv.lrange<string>(KEY, 0, -1);
  return items;
};

export const addItem = async (item: string) => {
  await kv.lpush(KEY, item.trim());
};

export const removeItem = async (item: string) => {
  await kv.lrem(KEY, 1, item);
};
