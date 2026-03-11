import { PokemonStateModel } from '../schemas/pokemon-state.schema.js';
import { throwMappedError } from '../map-repository-error.js';

function toDomain(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id?.toString(),
    battleId: obj.battleId?.toString(),
    pokemonId: obj.pokemonId,
    playerId: obj.playerId?.toString(),
    currentHp: obj.currentHp,
    defeated: obj.defeated ?? false,
    name: obj.name ?? '',
    sprite: obj.sprite ?? '',
    type: Array.isArray(obj.type) ? obj.type : [],
  };
}

export class PokemonStateMongoRepository {
  async save(state) {
    try {
      const payload = {
        battleId: state.battleId,
        pokemonId: state.pokemonId,
        playerId: state.playerId,
        currentHp: state.currentHp,
        defeated: state.defeated ?? false,
        name: state.name ?? '',
        sprite: state.sprite ?? '',
        type: Array.isArray(state.type) ? state.type : [],
      };
      let doc;
      if (state.id) {
        doc = await PokemonStateModel.findByIdAndUpdate(
          state.id,
          { $set: payload },
          { new: true, runValidators: true }
        );
        if (!doc) return null;
      } else {
        doc = new PokemonStateModel(payload);
        await doc.save();
      }
      return toDomain(doc);
    } catch (err) {
      throwMappedError(err);
    }
  }

  async findByBattleId(battleId) {
    const docs = await PokemonStateModel.find({ battleId }).lean();
    return docs.map((d) => toDomain({ ...d, _id: d._id }));
  }

  async saveMany(states) {
    const results = [];
    for (const state of states) {
      const saved = await this.save(state);
      if (saved) results.push(saved);
    }
    return results;
  }
}
