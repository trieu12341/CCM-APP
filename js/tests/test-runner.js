export function describe(description, fn) {
    console.group(`%c${description}`, 'color: #0284c7; font-weight: bold;');
    try {
        fn();
    } catch (e) {
        console.error(e);
    }
    console.groupEnd();
}

export function it(description, fn) {
    try {
        fn();
        console.log(`%c✓ ${description}`, 'color: #16a34a;');
    } catch (error) {
        console.error(`%c✗ ${description}`, 'color: #dc2626;');
        console.error(error);
    }
}

export function expect(actual) {
    return {
        toBe(expected) {
            if (actual !== expected) {
                throw new Error(`Expected ${expected} but received ${actual}`);
            }
        },
        toEqual(expected) {
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(expected)} but received ${JSON.stringify(actual)}`);
            }
        }
    };
}
