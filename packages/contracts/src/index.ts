import { z } from 'zod';

export const todoDueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('date'), value: z.iso.date() }),
  z.object({ kind: z.literal('datetime'), value: z.iso.datetime({ offset: true }) }),
]);

export const todoItemSchema = z.object({
  id: z.string(),
  summary: z.string(),
  due: todoDueSchema.nullable(),
  completed: z.boolean(),
});

export const shoppingItemSchema = z.object({
  id: z.string(),
  summary: z.string(),
  completed: z.boolean(),
});

export const weatherSchema = z.object({
  condition: z.string(),
  temperature: z.number(),
  unit: z.string(),
  feelsLike: z.number().optional(),
  humidity: z.number().optional(),
  windSpeed: z.number().optional(),
  hourly: z.array(z.object({
    time: z.string(),
    condition: z.string(),
    temperature: z.number(),
    precipitation: z.number().optional(),
  })).optional(),
  daily: z.array(z.object({
    date: z.string(),
    condition: z.string(),
    low: z.number(),
    high: z.number(),
  })).optional(),
});

export const roomStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  temperature: z.number().nullable(),
  humidity: z.number().nullable(),
  deviceName: z.string().nullable(),
  deviceState: z.string().nullable(),
  summary: z.string(),
});

export const photoSchema = z.object({
  id: z.string(),
  mediaUrl: z.string(),
  thumbnailUrl: z.string(),
  capturedAt: z.iso.datetime({ offset: true }),
  title: z.string(),
});

export function sectionSchema<T extends z.ZodType>(dataSchema: T) {
  return z.discriminatedUnion('status', [
    z.object({ status: z.literal('ready'), data: dataSchema, updatedAt: z.iso.datetime({ offset: true }) }),
    z.object({ status: z.literal('empty'), data: z.null(), updatedAt: z.iso.datetime({ offset: true }).nullable() }),
    z.object({
      status: z.literal('unavailable'),
      data: z.null(),
      updatedAt: z.iso.datetime({ offset: true }).nullable(),
      reason: z.enum(['source_unavailable', 'invalid_source_data', 'not_configured']),
    }),
  ]);
}

export const dashboardSchema = z.object({
  weather: sectionSchema(weatherSchema),
  todayTodos: sectionSchema(z.array(todoItemSchema)),
  memos: sectionSchema(z.array(todoItemSchema)),
  shopping: sectionSchema(z.array(shoppingItemSchema)),
  recentPhoto: sectionSchema(photoSchema),
});

export const statusSchema = z.object({
  rooms: sectionSchema(z.array(roomStatusSchema)),
});

export const photosSchema = z.object({
  photos: sectionSchema(z.array(photoSchema)),
});

export function apiEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: z.object({
      generatedAt: z.iso.datetime({ offset: true }),
      mode: z.enum(['live', 'mock']),
    }),
  });
}

export const dashboardResponseSchema = apiEnvelopeSchema(dashboardSchema);
export const statusResponseSchema = apiEnvelopeSchema(statusSchema);
export const photosResponseSchema = apiEnvelopeSchema(photosSchema);

export type TodoDue = z.infer<typeof todoDueSchema>;
export type TodoItem = z.infer<typeof todoItemSchema>;
export type ShoppingItem = z.infer<typeof shoppingItemSchema>;
export type Weather = z.infer<typeof weatherSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type PhotosResponse = z.infer<typeof photosResponseSchema>;
