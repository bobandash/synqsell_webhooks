function createMapIdToRestObj<T extends { [key: string]: any }, K extends keyof T>(
    data: T[],
    idKey: K,
): Map<string, Omit<T, K>> {
    const map = new Map<string, Omit<T, K>>();
    data.forEach((entry) => {
        const id = entry[idKey] as unknown as string;
        if (id !== undefined) {
            const { [idKey]: _, ...rest } = entry;
            map.set(id, rest as Omit<T, K>);
        }
    });

    return map;
}

export default createMapIdToRestObj;
