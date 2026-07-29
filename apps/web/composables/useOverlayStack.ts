const BASE_Z_INDEX = 50;
const Z_INDEX_STEP = 10;

let nextId = 0;
const stack: number[] = [];
let highestZIndex = BASE_Z_INDEX;

export function useOverlayStack() {
  const id = nextId++;
  const zIndex = ref(BASE_Z_INDEX);

  if (import.meta.client) {
    // Sit above whatever is already open; start over once the last one closes.
    highestZIndex = stack.length === 0 ? BASE_Z_INDEX : highestZIndex + Z_INDEX_STEP;
    zIndex.value = highestZIndex;
    stack.push(id);
    onUnmounted(() => {
      const index = stack.indexOf(id);
      if (index !== -1) stack.splice(index, 1);
    });
  }

  function isTopmost(): boolean {
    return stack[stack.length - 1] === id;
  }

  return { zIndex, isTopmost };
}
