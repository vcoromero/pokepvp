import { InvalidConfigError } from "../errors/InvalidConfig.error.js";
import { ThirdPartyApiFailedError } from "../errors/ThirdPartyApiFailed.error.js";

const getBaseUrl = () => {
    const url = process.env.POKEAPI_BASE_URL;
    if (!url) {
        throw new InvalidConfigError('POKEAPI_BASE_URL environment variable is not set');
    }
    return url.replace(/\/$/, '');
};

export const PokeAPIAdapter = {
    getList: async () => {
        const response = await fetch(`${getBaseUrl()}/list`);
        if (!response.ok) {
            throw new ThirdPartyApiFailedError(
                `PokeAPI list failed: ${response.status} ${response.statusText}`,
                response.status
            );
        }
        return response.json();
    },
    getById: async (id) => {
        const response = await fetch(`${getBaseUrl()}/list/${encodeURIComponent(id)}`);
        if (!response.ok) {
            throw new ThirdPartyApiFailedError(
                `PokeAPI detail failed: ${response.status} ${response.statusText}`,
                response.status
            );
        }
        return response.json();
    },
};