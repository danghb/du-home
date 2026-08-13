import { z } from 'zod';

export const todoDueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('date'), value: z.iso.date() }),
  z.object({ kind: z.literal('datetime'), value: z.iso.datetime({ offset: true }) }),
]);

export const todoItemSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().nullable(),
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
  windUnit: z.string().optional(),
  pressure: z.number().optional(),
  pressureUnit: z.string().optional(),
  uvIndex: z.number().optional(),
  source: z.string().optional(),
  hourly: z.array(z.object({
    time: z.string(),
    condition: z.string(),
    temperature: z.number(),
    precipitation: z.number().optional(),
    precipitationUnit: z.string().optional(),
    precipitationProbability: z.number().optional(),
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
  devices: z.array(z.object({ label: z.string(), state: z.string(), tone: z.enum(['normal', 'active', 'warning']) })).optional(),
});

export const householdAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  severity: z.enum(['info', 'warning']),
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
  householdSummary: sectionSchema(z.object({
    doorStatus: z.string(),
    activeDeviceCount: z.number().int().nonnegative(),
    alerts: z.array(householdAlertSchema),
  })).optional(),
});

export const statusSchema = z.object({
  rooms: sectionSchema(z.array(roomStatusSchema)),
  overview: sectionSchema(z.object({
    activeDeviceCount: z.number().int().nonnegative(),
    doorStatus: z.string(),
  })).optional(),
  alerts: sectionSchema(z.array(householdAlertSchema)).optional(),
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
export type HouseholdAlert = z.infer<typeof householdAlertSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type PhotosResponse = z.infer<typeof photosResponseSchema>;
