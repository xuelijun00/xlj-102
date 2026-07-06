let broadcast = null;

const setBroadcast = (fn) => {
  broadcast = fn;
};

const getBroadcast = () => broadcast;

module.exports = { setBroadcast, getBroadcast };
