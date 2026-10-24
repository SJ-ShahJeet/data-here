// Test the linePath function golden cases
const { linePath } = require('./lib/charts/series.ts');

console.log('Testing linePath golden cases:');
console.log('linePath([], 100, 50):', linePath([], 100, 50));
console.log('Expected: ""');
console.log('');

console.log('linePath([{x:0,y:5}], 100, 50):', linePath([{x:0,y:5}], 100, 50));
console.log('Expected: "M 50 25"');
console.log('');

console.log('linePath([{x:0,y:0},{x:1,y:10}], 100, 50):', linePath([{x:0,y:0},{x:1,y:10}], 100, 50));
console.log('Expected: "M 8 42 L 92 8"');
console.log('');

console.log('linePath([{x:0,y:5},{x:1,y:5},{x:2,y:5}], 100, 50):', linePath([{x:0,y:5},{x:1,y:5},{x:2,y:5}], 100, 50));
console.log('Expected: "M 8 25 L 50 25 L 92 25"');
console.log('');

console.log('linePath([{x:0,y:0},{x:1,y:1}], 100, 50, 0):', linePath([{x:0,y:0},{x:1,y:1}], 100, 50, 0));
console.log('Expected: "M 0 50 L 100 0"');
