const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gridSize = 10; // 减小尺寸，使蛇身和食物更小
const tileCount = 40; // 增加网格数量，使游戏更精细

// 游戏状态变量
let snake = [
  { x: 20, y: 20 }
];
let food = { x: 30, y: 20 };
let dx = 1;
let dy = 0;
let score = 0;
let highScore = 0;
let gameLoop;
let isAccelerating = false;
let isPaused = false;
let normalSpeed = 150; // 提高速度（减小毫秒数）
let fastSpeed = 70; // 提高加速速度（减小毫秒数）
let mouseSpeed = normalSpeed / 2; // 鼠标模式速度，比方向键模式快一倍

// 视觉效果变量
let foodBlinkState = 0; // 食物闪烁状态
let gridOpacity = 0.2; // 网格透明度

// 鼠标相关变量
let mouseX = null;
let mouseY = null;
let isMouseActive = false; // 标识鼠标是否在游戏区域内
let lastMouseUpdateTime = 0; // 上次鼠标移动的时间戳

// 按钮元素
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

// 初始化最高分
function initHighScore() {
  const savedHighScore = localStorage.getItem('snakeGameHighScore');
  if (savedHighScore) {
    highScore = parseInt(savedHighScore);
    document.getElementById('highScore').textContent = highScore;
  }
}

// 更新最高分
function updateHighScore() {
  if (score > highScore) {
    highScore = score;
    document.getElementById('highScore').textContent = highScore;
    localStorage.setItem('snakeGameHighScore', highScore.toString());
  }
}

function drawGame() {
  // 检查游戏是否暂停
  if (isPaused) {
    drawPauseScreen();
    return;
  }
  
  // 更新食物闪烁状态
  foodBlinkState = (foodBlinkState + 1) % 20;
  
  // 如果鼠标在活动区域，则根据鼠标位置智能调整方向
  if (isMouseActive && mouseX !== null && mouseY !== null) {
    const headX = snake[0].x * gridSize + gridSize / 2;
    const headY = snake[0].y * gridSize + gridSize / 2;
    
    // 计算鼠标与蛇头的相对位置（网格坐标）
    const targetGridX = Math.floor(mouseX / gridSize);
    const targetGridY = Math.floor(mouseY / gridSize);
    
    // 定义可能的移动方向（不包括180度掉头）
    const possibleDirections = [];
    
    // 当前方向
    const currentDir = { dx, dy };
    
    // 添加可能的方向（上、下、左、右，但排除相反方向）
    if (currentDir.dy !== 1) possibleDirections.push({ dx: 0, dy: -1 }); // 上
    if (currentDir.dy !== -1) possibleDirections.push({ dx: 0, dy: 1 }); // 下
    if (currentDir.dx !== -1) possibleDirections.push({ dx: 1, dy: 0 }); // 右
    if (currentDir.dx !== 1) possibleDirections.push({ dx: -1, dy: 0 }); // 左
    
    // 评估每个方向的安全性和目标接近度
    let bestDir = null;
    let bestScore = -Infinity;
    
    possibleDirections.forEach(dir => {
      // 计算移动后的位置
      const newX = snake[0].x + dir.dx;
      const newY = snake[0].y + dir.dy;
      
      // 检查是否会撞到墙壁
      const wallCollision = newX < 0 || newX >= tileCount || newY < 0 || newY >= tileCount;
      
      // 检查是否会撞到自己
      const selfCollision = snake.some(segment => segment.x === newX && segment.y === newY);
      
      // 如果不安全，跳过
      if (wallCollision || selfCollision) return;
      
      // 计算到目标的距离（使用曼哈顿距离）
      const distanceToTarget = Math.abs(newX - targetGridX) + Math.abs(newY - targetGridY);
      
      // 计算接近度分数（距离越近分数越高）
      const proximityScore = 1000 - distanceToTarget; // 基础分数
      
      // 给朝向目标的方向额外加分
      let alignmentBonus = 0;
      if (dir.dx !== 0) {
        // 水平方向移动
        if ((dir.dx === 1 && newX < targetGridX) || (dir.dx === -1 && newX > targetGridX)) {
          alignmentBonus = 500;
        }
      } else if (dir.dy !== 0) {
        // 垂直方向移动
        if ((dir.dy === 1 && newY < targetGridY) || (dir.dy === -1 && newY > targetGridY)) {
          alignmentBonus = 500;
        }
      }
      
      // 总分数
      const totalScore = proximityScore + alignmentBonus;
      
      // 更新最佳方向
      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestDir = dir;
      }
    });
    
    // 如果找到安全的方向，使用它
    if (bestDir) {
      dx = bestDir.dx;
      dy = bestDir.dy;
    }
  }
  
  // 移动蛇
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };
  
  // 立即检测碰撞（撞墙或撞自己）
  if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount || 
      snake.slice(1).some(segment => segment.x === head.x && segment.y === head.y)) {
    gameOver();
    return; // 碰撞后直接返回，不再执行后续绘制逻辑
  }
  
  snake.unshift(head);

  // 检测食物碰撞
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    document.getElementById('score').textContent = score;
    updateHighScore();
    generateFood();
  } else {
    snake.pop();
  }

  // 清空画布 - 使用渐变背景
  const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bgGradient.addColorStop(0, '#ecf0f1');
  bgGradient.addColorStop(1, '#bdc3c7');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 绘制网格背景
  drawGrid();

  // 绘制蛇身体 - 使用渐变色和阴影效果
  snake.slice(1).forEach((segment, index) => {
    // 根据位置设置颜色（从头部到尾部逐渐变浅）
    const greenShade = Math.max(128, 200 - index * 2);
    ctx.fillStyle = `rgb(76, ${greenShade}, 80)`;
    
    // 添加轻微的阴影效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    
    // 绘制略微圆润的身体方块
    const radius = 2;
    ctx.beginPath();
    ctx.moveTo(segment.x * gridSize + radius, segment.y * gridSize);
    ctx.lineTo(segment.x * gridSize + gridSize - radius, segment.y * gridSize);
    ctx.quadraticCurveTo(segment.x * gridSize + gridSize, segment.y * gridSize, 
                       segment.x * gridSize + gridSize, segment.y * gridSize + radius);
    ctx.lineTo(segment.x * gridSize + gridSize, segment.y * gridSize + gridSize - radius);
    ctx.quadraticCurveTo(segment.x * gridSize + gridSize, segment.y * gridSize + gridSize, 
                       segment.x * gridSize + gridSize - radius, segment.y * gridSize + gridSize);
    ctx.lineTo(segment.x * gridSize + radius, segment.y * gridSize + gridSize);
    ctx.quadraticCurveTo(segment.x * gridSize, segment.y * gridSize + gridSize, 
                       segment.x * gridSize, segment.y * gridSize + gridSize - radius);
    ctx.lineTo(segment.x * gridSize, segment.y * gridSize + radius);
    ctx.quadraticCurveTo(segment.x * gridSize, segment.y * gridSize, 
                       segment.x * gridSize + radius, segment.y * gridSize);
    ctx.closePath();
    ctx.fill();
    
    // 重置阴影
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });
  
  // 绘制蛇头（使用不同颜色并根据方向调整形状）
  const snakeHead = snake[0];
  const headSize = gridSize * 0.9; // 头部稍大
  const headOffset = (gridSize - headSize) / 2;
  
  ctx.fillStyle = '#2E7D32'; // 头深绿色
  
  // 根据移动方向绘制不同形状的蛇头
  if (dx === 1) { // 向右
    // 三角形蛇头
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize + gridSize, snakeHead.y * gridSize + gridSize / 2);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.3, snakeHead.y * gridSize);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.3, snakeHead.y * gridSize + gridSize);
    ctx.closePath();
    ctx.fill();
    
    // 眼睛
    ctx.fillStyle = 'white';
    const eyeSize = gridSize / 6;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.4, snakeHead.y * gridSize + gridSize * 0.3, eyeSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.4, snakeHead.y * gridSize + gridSize * 0.7, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 眼球（黑色小点）
    ctx.fillStyle = 'black';
    const pupilSize = eyeSize / 2;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.4, snakeHead.y * gridSize + gridSize * 0.3, pupilSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.4, snakeHead.y * gridSize + gridSize * 0.7, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 舌头
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize + gridSize, snakeHead.y * gridSize + gridSize / 2);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 1.2, snakeHead.y * gridSize + gridSize * 0.4);
    ctx.moveTo(snakeHead.x * gridSize + gridSize, snakeHead.y * gridSize + gridSize / 2);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 1.2, snakeHead.y * gridSize + gridSize * 0.6);
    ctx.lineWidth = 1; // 适应较小的gridSize
    ctx.stroke();
  } else if (dx === -1) { // 向左
    // 三角形蛇头
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize, snakeHead.y * gridSize + gridSize / 2);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.7, snakeHead.y * gridSize);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.7, snakeHead.y * gridSize + gridSize);
    ctx.closePath();
    ctx.fill();
    
    // 眼睛
    ctx.fillStyle = 'white';
    const eyeSize = gridSize / 6;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.6, snakeHead.y * gridSize + gridSize * 0.3, eyeSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.6, snakeHead.y * gridSize + gridSize * 0.7, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 眼球
    ctx.fillStyle = 'black';
    const pupilSize = eyeSize / 2;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.6, snakeHead.y * gridSize + gridSize * 0.3, pupilSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.6, snakeHead.y * gridSize + gridSize * 0.7, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 舌头
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize, snakeHead.y * gridSize + gridSize / 2);
    ctx.lineTo(snakeHead.x * gridSize - gridSize * 0.2, snakeHead.y * gridSize + gridSize * 0.4);
    ctx.moveTo(snakeHead.x * gridSize, snakeHead.y * gridSize + gridSize / 2);
    ctx.lineTo(snakeHead.x * gridSize - gridSize * 0.2, snakeHead.y * gridSize + gridSize * 0.6);
    ctx.lineWidth = 1; // 适应较小的gridSize
    ctx.stroke();
  } else if (dy === -1) { // 向上
    // 三角形蛇头
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize + gridSize / 2, snakeHead.y * gridSize);
    ctx.lineTo(snakeHead.x * gridSize, snakeHead.y * gridSize + gridSize * 0.7);
    ctx.lineTo(snakeHead.x * gridSize + gridSize, snakeHead.y * gridSize + gridSize * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // 眼睛
    ctx.fillStyle = 'white';
    const eyeSize = gridSize / 6;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.3, snakeHead.y * gridSize + gridSize * 0.4, eyeSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.7, snakeHead.y * gridSize + gridSize * 0.4, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 眼球
    ctx.fillStyle = 'black';
    const pupilSize = eyeSize / 2;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.3, snakeHead.y * gridSize + gridSize * 0.4, pupilSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.7, snakeHead.y * gridSize + gridSize * 0.4, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 舌头
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize + gridSize / 2, snakeHead.y * gridSize);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.4, snakeHead.y * gridSize - gridSize * 0.2);
    ctx.moveTo(snakeHead.x * gridSize + gridSize / 2, snakeHead.y * gridSize);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.6, snakeHead.y * gridSize - gridSize * 0.2);
    ctx.lineWidth = 1; // 适应较小的gridSize
    ctx.stroke();
  } else if (dy === 1) { // 向下
    // 三角形蛇头
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize + gridSize / 2, snakeHead.y * gridSize + gridSize);
    ctx.lineTo(snakeHead.x * gridSize, snakeHead.y * gridSize + gridSize * 0.3);
    ctx.lineTo(snakeHead.x * gridSize + gridSize, snakeHead.y * gridSize + gridSize * 0.3);
    ctx.closePath();
    ctx.fill();
    
    // 眼睛
    ctx.fillStyle = 'white';
    const eyeSize = gridSize / 6;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.3, snakeHead.y * gridSize + gridSize * 0.6, eyeSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.7, snakeHead.y * gridSize + gridSize * 0.6, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 眼球
    ctx.fillStyle = 'black';
    const pupilSize = eyeSize / 2;
    ctx.beginPath();
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.3, snakeHead.y * gridSize + gridSize * 0.6, pupilSize, 0, Math.PI * 2);
    ctx.arc(snakeHead.x * gridSize + gridSize * 0.7, snakeHead.y * gridSize + gridSize * 0.6, pupilSize, 0, Math.PI * 2);
    ctx.fill();
    
    // 舌头
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.moveTo(snakeHead.x * gridSize + gridSize / 2, snakeHead.y * gridSize + gridSize);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.4, snakeHead.y * gridSize + gridSize * 1.2);
    ctx.moveTo(snakeHead.x * gridSize + gridSize / 2, snakeHead.y * gridSize + gridSize);
    ctx.lineTo(snakeHead.x * gridSize + gridSize * 0.6, snakeHead.y * gridSize + gridSize * 1.2);
    ctx.lineWidth = 1; // 适应较小的gridSize
    ctx.stroke();
  }
  
  // 重置线条样式
  ctx.lineWidth = 1; // 适应较小的gridSize

  // 绘制食物 - 添加动画效果和圆形设计
  ctx.save();
  
  // 根据闪烁状态调整大小和颜色
  const foodSize = gridSize - 2 + Math.sin(foodBlinkState * 0.2) * 1;
  const foodOffset = (gridSize - foodSize) / 2;
  
  // 使用颜色渐变
  const foodGradient = ctx.createRadialGradient(
    food.x * gridSize + gridSize/2, 
    food.y * gridSize + gridSize/2, 
    2,
    food.x * gridSize + gridSize/2, 
    food.y * gridSize + gridSize/2, 
    gridSize/2
  );
  foodGradient.addColorStop(0, '#FF6B6B');
  foodGradient.addColorStop(1, '#FF4081');
  
  ctx.fillStyle = foodGradient;
  
  // 绘制圆形食物
  ctx.beginPath();
  ctx.arc(
    food.x * gridSize + gridSize/2, 
    food.y * gridSize + gridSize/2, 
    foodSize/2, 
    0, 
    Math.PI * 2
  );
  ctx.fill();
  
  // 添加光泽效果
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(
    food.x * gridSize + gridSize/3, 
    food.y * gridSize + gridSize/3, 
    foodSize/6, 
    0, 
    Math.PI * 2
  );
  ctx.fill();
  
  ctx.restore();
}

// 绘制背景网格
function drawGrid() {
  ctx.strokeStyle = `rgba(52, 73, 94, ${gridOpacity})`;
  ctx.lineWidth = 0.5;
  
  // 绘制垂直线
  for (let x = 0; x <= tileCount; x++) {
    ctx.beginPath();
    ctx.moveTo(x * gridSize, 0);
    ctx.lineTo(x * gridSize, canvas.height);
    ctx.stroke();
  }
  
  // 绘制水平线
  for (let y = 0; y <= tileCount; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * gridSize);
    ctx.lineTo(canvas.width, y * gridSize);
    ctx.stroke();
  }
}

// 绘制暂停屏幕
function drawPauseScreen() {
  // 半透明遮罩
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 暂停文字
  ctx.fillStyle = 'white';
  ctx.font = '36px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游戏暂停', canvas.width/2, canvas.height/2);
  
  // 提示文字
  ctx.font = '16px Arial';
  ctx.fillText('点击继续或按空格键', canvas.width/2, canvas.height/2 + 40);
  ctx.font = '14px Arial';
  ctx.fillText('使用方向键或WASD控制移动', canvas.width/2, canvas.height/2 + 70);
}

function generateFood() {
  food = {
    x: Math.floor(Math.random() * tileCount),
    y: Math.floor(Math.random() * tileCount)
  };
  // 确保食物不在蛇身上
  if (snake.some(segment => segment.x === food.x && segment.y === food.y)) {
    generateFood();
  }
}

function gameOver() {
  clearInterval(gameLoop);
  
  // 更新最高分
  updateHighScore();
  
  // 绘制游戏结束画面
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 游戏结束文字
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游戏结束', canvas.width/2, canvas.height/2 - 60);
  
  // 得分显示
  ctx.fillStyle = 'white';
  ctx.font = '24px Arial';
  ctx.fillText(`得分: ${score}`, canvas.width/2, canvas.height/2);
  ctx.fillText(`最高分: ${highScore}`, canvas.width/2, canvas.height/2 + 30);
  
  // 提示文字
  ctx.font = '18px Arial';
  ctx.fillText('点击重新开始按钮或刷新页面', canvas.width/2, canvas.height/2 + 70);
  ctx.font = '14px Arial';
  ctx.fillText('使用方向键或WASD控制移动', canvas.width/2, canvas.height/2 + 100);
  
  // 移除键盘事件监听，防止游戏结束后仍能控制方向
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
}

// 重置游戏
function resetGame() {
  // 清除游戏循环
  clearInterval(gameLoop);
  
  // 重置游戏状态
  snake = [{ x: 20, y: 20 }];
  food = { x: 30, y: 20 };
  dx = 1;
  dy = 0;
  score = 0;
  isPaused = false;
  isAccelerating = false;
  isMouseActive = false;
  
  // 更新UI
  document.getElementById('score').textContent = score;
  
  // 重新生成食物
  generateFood();
  
  // 重新启动游戏
  setGameSpeed();
  
  // 重新添加事件监听器
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
}

// 暂停/继续游戏
function togglePause() {
  isPaused = !isPaused;
}

// 设置游戏循环的函数
function setGameSpeed() {
  clearInterval(gameLoop);
  let speed;
  
  // 鼠标模式优先级高于方向键加速模式
  if (isMouseActive) {
    speed = mouseSpeed; // 鼠标模式下使用更快的速度
  } else {
    speed = isAccelerating ? fastSpeed : normalSpeed;
  }
  
  gameLoop = setInterval(drawGame, speed);
}

// 键盘控制 - keydown事件处理函数
function handleKeyDown(e) {
  switch(e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (dy !== 1) { 
        dx = 0; 
        dy = -1; 
      }
      // 按住方向键时加速 - 确保每次按下都设置为true
      if (!isAccelerating && !isMouseActive) {
        isAccelerating = true;
        setGameSpeed();
      }
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      if (dy !== -1) { 
        dx = 0; 
        dy = 1; 
      }
      // 按住方向键时加速 - 确保每次按下都设置为true
      if (!isAccelerating && !isMouseActive) {
        isAccelerating = true;
        setGameSpeed();
      }
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      if (dx !== 1) { 
        dx = -1; 
        dy = 0; 
      }
      // 按住方向键时加速 - 确保每次按下都设置为true
      if (!isAccelerating && !isMouseActive) {
        isAccelerating = true;
        setGameSpeed();
      }
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (dx !== -1) { 
        dx = 1; 
        dy = 0; 
      }
      // 按住方向键时加速 - 确保每次按下都设置为true
      if (!isAccelerating && !isMouseActive) {
        isAccelerating = true;
        setGameSpeed();
      }
      break;
    case ' ':
      // 空格键暂停/继续游戏
      e.preventDefault(); // 防止页面滚动
      togglePause();
      break;
  }
}

// 键盘控制 - keyup事件处理函数
function handleKeyUp(e) {
  // 当释放方向键时恢复正常速度
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
    // 检查是否还有其他方向键被按住
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'];
    const anyKeyPressed = keys.some(key => key !== e.key && keyStates[key]);
    
    if (!anyKeyPressed) {
      isAccelerating = false;
      setGameSpeed();
    }
  }
}

// 辅助函数：检查按键是否被按住
function isKeyPressed(key) {
  return keyStates[key];
}

// 添加按键状态跟踪
let keyStates = {};

document.addEventListener('keydown', (e) => {
  keyStates[e.key] = true;
});

document.addEventListener('keyup', (e) => {
  keyStates[e.key] = false;
});

// 鼠标移动事件处理函数
function handleMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  isMouseActive = true;
  lastMouseUpdateTime = Date.now();
  setGameSpeed(); // 鼠标进入时更新游戏速度
}

// 鼠标离开事件处理函数
function handleMouseLeave() {
  isMouseActive = false;
  setGameSpeed(); // 鼠标离开时更新游戏速度
}

// 初始化按钮事件监听器
function initButtons() {
  // 开始游戏按钮
  startBtn.addEventListener('click', () => {
    if (!gameLoop) {
      setGameSpeed();
    } else if (isPaused) {
      togglePause();
    }
  });
  
  // 暂停/继续按钮
  pauseBtn.addEventListener('click', togglePause);
  
  // 重新开始按钮
  resetBtn.addEventListener('click', resetGame);
  
  // 点击画布也可以暂停/继续
  canvas.addEventListener('click', togglePause);
}

// 添加事件监听器
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseleave', handleMouseLeave);

// 初始化游戏
function initGame() {
  initHighScore();
  initButtons();
  generateFood(); // 先生成食物
  setGameSpeed(); // 然后启动游戏循环
  
  // 初始绘制一次暂停界面
  isPaused = true;
}

// 启动游戏
initGame();