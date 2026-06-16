export type SerializedData = any;

export interface ISerializable {
  /**
   * Restores the "state" of the class implementing the interface based on the data returned by `serialize`.
   *
   * The implementation has to be idempotent.
   */
  deserialize(dump: SerializedData): void;

  /**
   * Returns the "state" of the class implementing the interface.
   *
   * The important thing is that `deserialize` is able to restore the same state of affairs
   * based on the serialized data.
   *
   * It does not matter wether this "state" is used to (re-)render frontend components or
   * keep track of backend services.
   */
  serialize(): SerializedData;
}
