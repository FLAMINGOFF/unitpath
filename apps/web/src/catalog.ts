import { catalogSchema } from "@unitpath/engine";
import raw from "./catalog.json";

export const catalog = catalogSchema.parse(raw);
