import { describe, expect, it, vi } from 'vitest';
import { HomeAssistantHouseholdService } from './home-assistant-household.service.js';

function state(entity_id: string, value: string) {
  return { entity_id, state: value, attributes: {} };
}

describe('HomeAssistantHouseholdService', () => {
  it('maps room sensors, device states, door and todo lists', async () => {
    const source = {
      getStates: vi.fn().mockResolvedValue([
        state('sensor.xiaomi_cn_blt_3_1p22r1u6o4001_mini_temperature_p_2_1001', '28.9'),
        state('sensor.xiaomi_cn_blt_3_1p22r1u6o4001_mini_relative_humidity_p_2_1002', '75'),
        state('sensor.miaomiaoc_cn_blt_3_1ddrtj6205k00_t2_temperature_p_2_1', '27.8'),
        state('sensor.miaomiaoc_cn_blt_3_1ddrtj6205k00_t2_relative_humidity_p_2_2', '83.4'),
        state('climate.ke_ting_kong_diao_kong_diao', 'cool'),
        state('climate.zhu_wo_kong_diao_kong_diao', 'off'),
        state('climate.bei_ci_wo_kong_diao_kong_diao', 'off'),
        state('climate.nan_ci_wo_kong_diao_kong_diao', 'off'),
        state('sensor.xiaomi_cn_1193916199_s1_door_state_p_3_1021', '已上锁'),
        state('light.ke_ting_zhu_deng', 'on'),
      ]),
      getTodoItems: vi.fn().mockResolvedValue({
        'todo.dai_ban_shi_xiang': [{ uid: 'memo', summary: '家庭事项', status: 'needs_action' }],
        'todo.shopping_list': [{ uid: 'milk', summary: '牛奶', status: 'needs_action' }],
      }),
    };
    const service = new HomeAssistantHouseholdService(source, 'Asia/Hong_Kong', 30_000);
    await service.start();
    const snapshot = service.getSnapshot();

    expect(snapshot?.rooms[0]).toMatchObject({ name: '客厅', temperature: 28.9, humidity: 75, deviceState: '制冷' });
    expect(snapshot?.rooms[2]).toMatchObject({ name: '书房', temperature: null, humidity: null });
    expect(snapshot?.activeDeviceCount).toBe(2);
    expect(snapshot?.doorStatus).toBe('已上锁');
    expect(snapshot?.memos[0]?.summary).toBe('家庭事项');
    expect(snapshot?.shopping[0]?.summary).toBe('牛奶');
    service.stop();
  });

  it('keeps the last snapshot when refresh fails', async () => {
    const source = {
      getStates: vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline')),
      getTodoItems: vi.fn().mockResolvedValue({ 'todo.dai_ban_shi_xiang': [], 'todo.shopping_list': [] }),
    };
    const service = new HomeAssistantHouseholdService(source, 'Asia/Hong_Kong', 30_000);
    await service.start();
    await service.refresh();
    expect(service.getSnapshot()).not.toBeNull();
    service.stop();
  });
});
