export class InvalidConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidConfigError';
    }
}