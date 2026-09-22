export declare function fetchMembers(arg0: string, arg1: boolean, arg2: boolean, arg3: number): Promise<Array<{ "id": number; "name": string; "role": string; "team": string; "initials": string; "hue": string; }>>;
export declare function summarize(arg0: Array<{ "id": number; "name": string; "role": string; "team": string; "initials": string; "hue": string; }>): Promise<{ "label": string; }>;
