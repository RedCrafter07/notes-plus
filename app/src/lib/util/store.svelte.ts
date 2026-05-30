export class Store<T> {
  store: T = $state<T>()!;

  constructor(defaultValue?: T) {
    if (defaultValue) this.store = defaultValue;
  }
}
