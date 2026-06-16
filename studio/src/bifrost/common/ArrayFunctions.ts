/**
 * Takes a `contentArray` and sorts its members according to their position in an `orderArray`.
 *
 * The resulting array has the same elements as `contentArray`, with those elements being present in `orderArray`
 * taking precende in the sorting.
 *
 * Example:
 *
 *    > orderedUnify(['y', '1', 'a', 'b', 'x', '3'], ['a', 'b', '1', '2'])
 *    ['a', 'b', '1', 'y', 'x', '3']
 *
 *    // if we add '3' to the order, it gets sorted accordingly:

 *    > orderedUnify(['y', '1', 'a', 'b', 'x', '3'], ['a', 'b', '1', '2', '3'])
 *    ['a', 'b', '1', '3', 'y', 'x']
 *
 */
export function orderedUnify(contentArray: any[], orderArray: any[]): any[] {
  const orderedHead = orderArray.filter((orderItem: any) => contentArray.indexOf(orderItem) !== -1);
  const contentTail = contentArray.filter((contentItem: any) => orderArray.indexOf(contentItem) === -1);

  return [...orderedHead].concat([...contentTail]);
}
