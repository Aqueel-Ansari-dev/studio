export interface Shift {
    start: string; // ISO 8601 timestamp
    end: string; // ISO 8601 timestamp
    graceEarly: number; // minutes
    graceLate: number; // minutes
}

export const resolveShift = async (employeeId: string): Promise<Shift> => {
    // Mock implementation - replace with actual logic to fetch shift from roster table
    return {
        start: '08:00',
        end: '18:00',
        graceEarly: 15,
        graceLate: 10,
    };
};