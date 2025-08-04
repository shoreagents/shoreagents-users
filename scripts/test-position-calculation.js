// Test position calculation logic
function testPositionCalculation() {
  console.log('Testing position calculation...')
  
  // Simulate the drop position calculation
  const simulateDrop = (dropY, taskPositions) => {
    let targetPosition = 1
    
    if (taskPositions.length === 0) {
      targetPosition = 1
    } else {
      for (let i = 0; i < taskPositions.length; i++) {
        const taskTop = i * 100 // Simulate task height
        const taskBottom = (i + 1) * 100
        
        if (dropY < (taskTop + taskBottom) / 2) {
          targetPosition = i + 1
          break
        }
        targetPosition = i + 2
      }
    }
    
    return targetPosition
  }
  
  // Test cases
  const testCases = [
    { dropY: 50, tasks: 3, expected: 1, description: 'Drop at top' },
    { dropY: 150, tasks: 3, expected: 2, description: 'Drop between task 1 and 2' },
    { dropY: 250, tasks: 3, expected: 3, description: 'Drop between task 2 and 3' },
    { dropY: 350, tasks: 3, expected: 4, description: 'Drop at bottom' },
    { dropY: 100, tasks: 0, expected: 1, description: 'Drop in empty column' }
  ]
  
  testCases.forEach(test => {
    const taskPositions = Array(test.tasks).fill(0).map((_, i) => i)
    const result = simulateDrop(test.dropY, taskPositions)
    const status = result === test.expected ? '✅' : '❌'
    console.log(`${status} ${test.description}: Expected ${test.expected}, Got ${result}`)
  })
}

testPositionCalculation() 