export type VenueStaffRole = 'EMPLOYEE' | 'MANAGER' | 'OWNER';

export type StaffVenueSummary = {
  venueId: string;
  role: VenueStaffRole;
  venueName: string;
};

export function isManagerPlusRole(role: VenueStaffRole | null | undefined): boolean {
  return role === 'MANAGER' || role === 'OWNER';
}

export function staffRoleLabelKey(role: VenueStaffRole): string {
  switch (role) {
    case 'OWNER':
      return 'staff.roleOwner';
    case 'MANAGER':
      return 'staff.roleManager';
    case 'EMPLOYEE':
      return 'staff.roleEmployee';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
