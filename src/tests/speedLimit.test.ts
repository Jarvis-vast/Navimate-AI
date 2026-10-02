import { describe, it, expect } from 'vitest';
import { compareSpeedAgainstLimit, speedLimitService } from '../services/speedLimit';

describe('compareSpeedAgainstLimit Function', () => {
  it('handles null or missing speed limits gracefully', () => {
    const result = compareSpeedAgainstLimit(65, null);
    expect(result.isOverspeed).toBe(false);
    expect(result.severity).toBe('normal');
    expect(result.excessSpeedKmh).toBe(0);
    expect(result.alertTitle).toContain('Normal');
  });

  it('marks safe speed when vehicle is at or below the posted limit', () => {
    const exact = compareSpeedAgainstLimit(50, 50);
    expect(exact.isOverspeed).toBe(false);
    expect(exact.severity).toBe('normal');
    expect(exact.excessSpeedKmh).toBe(0);

    const under = compareSpeedAgainstLimit(42, 50);
    expect(under.isOverspeed).toBe(false);
    expect(under.severity).toBe('normal');
    expect(under.excessSpeedKmh).toBe(0);
    expect(under.alertMessage).toContain('Cruising at 42 km/h');
  });

  it('classifies caution buffer when exceeding limit by <= 3 km/h', () => {
    const caution = compareSpeedAgainstLimit(52, 50, 3);
    expect(caution.isOverspeed).toBe(true);
    expect(caution.severity).toBe('caution');
    expect(caution.excessSpeedKmh).toBe(2);
    expect(caution.alertTitle).toContain('Threshold');
    expect(caution.soundAlert).toBe(false);
  });

  it('classifies warning when exceeding limit by 4 to 15 km/h', () => {
    const warning = compareSpeedAgainstLimit(62, 50, 3);
    expect(warning.isOverspeed).toBe(true);
    expect(warning.severity).toBe('warning');
    expect(warning.excessSpeedKmh).toBe(12);
    expect(warning.percentageOver).toBe(24);
    expect(warning.alertTitle).toBe('Speed Limit Exceeded');
    expect(warning.soundAlert).toBe(true);
  });

  it('classifies critical hazard when exceeding limit by > 15 km/h', () => {
    const critical = compareSpeedAgainstLimit(78, 50, 3);
    expect(critical.isOverspeed).toBe(true);
    expect(critical.severity).toBe('critical');
    expect(critical.excessSpeedKmh).toBe(28);
    expect(critical.percentageOver).toBe(56);
    expect(critical.alertTitle).toContain('Critical');
    expect(critical.soundAlert).toBe(true);
  });
});

describe('speedLimitService Mock Integration', () => {
  it('correctly derives context-aware speed limits for various roadway types', () => {
    const exp = speedLimitService.deriveSpeedLimitFromContext('Mumbai-Pune Expressway');
    expect(exp.speedLimitKmh).toBe(100);
    expect(exp.roadType).toBe('expressway');

    const hwy = speedLimitService.deriveSpeedLimitFromContext('NH-48 National Highway Corridor');
    expect(hwy.speedLimitKmh).toBe(80);
    expect(hwy.roadType).toBe('highway');

    const arterial = speedLimitService.deriveSpeedLimitFromContext('Senapati Bapat Ring Road');
    expect(arterial.speedLimitKmh).toBe(60);
    expect(arterial.roadType).toBe('arterial');

    const school = speedLimitService.deriveSpeedLimitFromContext('St. Mary School Zone Lane');
    expect(school.speedLimitKmh).toBe(30);
    expect(school.roadType).toBe('school_zone');
    expect(school.schoolZone).toBe(true);

    const urban = speedLimitService.deriveSpeedLimitFromContext('FC Road Market');
    expect(urban.speedLimitKmh).toBe(50);
    expect(urban.roadType).toBe('urban');
  });

  it('supports manual simulator override', async () => {
    speedLimitService.setManualOverride(70);
    const limit = await speedLimitService.fetchPostedSpeedLimit({ lat: 18.52, lng: 73.85 }, 'Test Road');
    expect(limit.speedLimitKmh).toBe(70);

    speedLimitService.setManualOverride(null);
  });
});
