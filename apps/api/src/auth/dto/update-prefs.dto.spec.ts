import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdatePrefsDto } from './update-prefs.dto';

// Cycle 49 — UpdatePrefsDto class-validator 검증.

describe('UpdatePrefsDto', () => {
  it('passes when empty (all fields optional)', async () => {
    const dto = plainToInstance(UpdatePrefsDto, {});
    expect(await validate(dto)).toEqual([]);
  });

  it('passes when showPersonalSpaceInSidebar is true', async () => {
    const dto = plainToInstance(UpdatePrefsDto, {
      showPersonalSpaceInSidebar: true,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('passes when showPersonalSpaceInSidebar is false', async () => {
    const dto = plainToInstance(UpdatePrefsDto, {
      showPersonalSpaceInSidebar: false,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('fails when showPersonalSpaceInSidebar is non-boolean', async () => {
    const dto = plainToInstance(UpdatePrefsDto, {
      showPersonalSpaceInSidebar: 'yes',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('showPersonalSpaceInSidebar');
    expect(errors[0].constraints).toHaveProperty('isBoolean');
  });
});
