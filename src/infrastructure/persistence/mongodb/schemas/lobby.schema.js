import mongoose from 'mongoose';

const lobbySchema = new mongoose.Schema({
  status: {
    type: String,
    required: true,
    enum: ['waiting', 'ready', 'battling', 'finished'],
  },
  playerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
  readyPlayerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: [] }],
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

lobbySchema.index({ status: 1 });

export const LobbyModel = mongoose.models.Lobby ?? mongoose.model('Lobby', lobbySchema);
