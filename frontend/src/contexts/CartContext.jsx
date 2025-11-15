import { createContext, useContext, useMemo, useReducer } from 'react';

const CartContext = createContext(null);

const initialState = {
  items: [],
  restaurant: null,
  isOpen: false
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const sameRestaurant = !state.restaurant || state.restaurant.id === action.restaurant.id;
      const baseItems = sameRestaurant ? state.items : [];
      const existing = baseItems.find((item) => item.menuItemId === action.payload.menuItemId);
      const items = existing
        ? baseItems.map((item) =>
            item.menuItemId === action.payload.menuItemId
              ? {
                  ...item,
                  quantity: item.quantity + action.payload.quantity,
                  subtotal: (item.quantity + action.payload.quantity) * item.price
                }
              : item
          )
        : [...baseItems, action.payload];
      return { ...state, items, restaurant: action.restaurant, isOpen: true };
    }
    case 'REMOVE_ITEM': {
      const items = state.items.filter((item) => item.menuItemId !== action.menuItemId);
      const restaurant = items.length === 0 ? null : state.restaurant;
      return { ...state, items, restaurant };
    }
    case 'CLEAR':
      return { ...initialState };
    case 'TOGGLE':
      return { ...state, isOpen: action.value ?? !state.isOpen };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const totals = useMemo(() => {
    const subtotal = state.items.reduce((sum, item) => sum + item.subtotal, 0);
    const delivery = subtotal > 0 ? 3000 : 0;
    return {
      subtotal,
      delivery,
      total: subtotal + delivery
    };
  }, [state.items]);

  const value = {
    ...state,
    totals,
    addItem: (item, restaurant) => dispatch({ type: 'ADD_ITEM', payload: item, restaurant }),
    removeItem: (menuItemId) => dispatch({ type: 'REMOVE_ITEM', menuItemId }),
    clear: () => dispatch({ type: 'CLEAR' }),
    toggle: (value) => dispatch({ type: 'TOGGLE', value })
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
