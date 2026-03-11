import mongoose from 'mongoose';

const pokemonStateSchema = new mongoose.Schema({
  battleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Battle', required: true },
  pokemonId: { type: Number, required: true },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  currentHp: { type: Number, required: true },
  defeated: { type: Boolean, default: false },
  name: { type: String, default: '' },
  sprite: { type: String, default: '' },
  type: { type: [String], default: [] },
}, { timestamps: true });

pokemonStateSchema.index({ battleId: 1, playerId: 1, pokemonId: 1 });

export const PokemonStateModel = mongoose.models.PokemonState ?? mongoose.model('PokemonState', pokemonStateSchema);
