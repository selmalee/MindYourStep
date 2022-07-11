import { _decorator, Component, Prefab, instantiate, Node, Label, Color } from 'cc';
import { PlayerController } from './PlayerController';
const { ccclass, property } = _decorator;

// 游戏分为三个状态
enum GameState{
  GS_INIT, // 初始化（Init）：显示游戏菜单，初始化一些资源。
  GS_PLAYING, // 游戏进行中（Playing）：隐藏游戏菜单，玩家可以操作角色进行游戏。
  GS_WIN, // 结束（End）：游戏结束，显示结束菜单。
  GS_DIE, // 结束（End）：游戏结束，显示结束菜单。
};
// 赛道格子类型，坑（BT_NONE）或者实路（BT_STONE）
enum BlockType {
  BT_NONE,
  BT_STONE,
};

@ccclass("GameManager")
export class GameManager extends Component {
  // 引用PlayerController脚本
  @property({type: PlayerController})
  public playerCtrl: PlayerController | null = null;
  // 动态地开启/关闭开始菜单
  @property({type: Node})
  public startMenu: Node | null = null;
  // 动态地开启/关闭开始菜单
  @property({type: Node})
  public EndMenu: Node | null = null;
  // 赛道预制
  @property({type: Prefab})
  public cubePrfb: Prefab | null = null;
  // 赛道长度
  @property
  public roadLength = 50;
  private _road: BlockType[] = [];
  // 当前步数展示
  @property({type: Label})
  public stepsLabel: Label | null = null;
  private _steps: Number = 0;
  // 结束分数
  @property({type: Label})
  public scoreLabel: Label | null = null;
  // 结果
  @property({type: Label})
  public resultLabel: Label | null = null;

  start() {
    this.curState = GameState.GS_INIT;
    this.playerCtrl?.node.on('JumpEnd', this.onPlayerJumpEnd, this);
  }

  init() {
    // 激活主界面
    if (this.EndMenu) {
      this.EndMenu.active = false;
    }
    if (this.startMenu) {
      this.startMenu.active = true;
    }
    // 生成赛道
    this.generateRoad();
    if(this.playerCtrl){
      // 禁止接收用户操作人物移动指令
      this.playerCtrl.setInputActive(false);
      // 重置人物位置等
      this.playerCtrl.reset();
    }
  }

  end(isWin) {
    // 激活主界面
    if (this.EndMenu) {
      this.EndMenu.active = true;
    }
    if (this.stepsLabel) {
      this.stepsLabel.string = '';
    }
    if (this.scoreLabel) {
      this.scoreLabel.string = `Your Score: ${this._steps}`;
    }
    if (this.resultLabel) {
      this.resultLabel.string = isWin ? 'You Win!' : 'You Died!';
      this.resultLabel.color = isWin ? new Color(0, 0, 255) : new Color(255, 0, 0);
    }
    // 禁止接收用户操作人物移动指令
    this.playerCtrl?.setInputActive(false);
  }

  set curState (value: GameState) {
    switch(value) {
      case GameState.GS_INIT:
        this.init();
        break;
      case GameState.GS_PLAYING:
        if (this.startMenu) {
          this.startMenu.active = false;
        }
        if (this.stepsLabel) {
          this.stepsLabel.string = 'Steps: 0';   // 将步数重置为0
        }
        // 设置 active 为 true 时会直接开始监听鼠标事件，此时鼠标抬起事件还未派发
        // 会出现的现象就是，游戏开始的瞬间人物已经开始移动
        // 因此，这里需要做延迟处理
        setTimeout(() => {
          if (this.playerCtrl) {
            this.playerCtrl.setInputActive(true);
          }
        }, 0.1);
        break;
      case GameState.GS_WIN:
        this.end(true);
        break;
      case GameState.GS_DIE:
        this.end(false);
        this.playerCtrl?.die();
        break;
    }
  }

  // 响应按钮点击，开始游戏
  onStartButtonClicked() {
    this.curState = GameState.GS_PLAYING;
  }
  onReplayButtonClicked() {
    this.curState = GameState.GS_INIT;
  }

  generateRoad() {
    // 防止游戏重新开始时，赛道还是旧的赛道
    // 因此，需要移除旧赛道，清除旧赛道数据
    this.node.removeAllChildren();
    this._road = [];
    // 确保游戏运行时，人物一定站在实路上
    this._road.push(BlockType.BT_STONE);

    // 确定好每一格赛道类型
    for (let i = 1; i < this.roadLength; i++) {
      // 如果上一格赛道是坑，那么这一格一定不能为坑
      if (this._road[i-1] === BlockType.BT_NONE) {
        this._road.push(BlockType.BT_STONE);
      } else {
        this._road.push(Math.floor(Math.random() * 2));
      }
    }

    // 根据赛道类型生成赛道
    for (let j = 0; j < this._road.length; j++) {
      let block: Node = this.spawnBlockByType(this._road[j]);
      // 判断是否生成了道路，因为 spawnBlockByType 有可能返回坑（值为 null）
      if (block) {
        this.node.addChild(block);
        block.setPosition(j, -1.5, 0);
      }
    }
  }

  spawnBlockByType(type: BlockType) {
    if (!this.cubePrfb) {
      return null;
    }

    let block: Node | null = null;
    // 赛道类型为实路才生成
    switch(type) {
      case BlockType.BT_STONE:
        block = instantiate(this.cubePrfb);
        break;
    }

    return block;
  }

  // 监听角色跳跃结束事件JumpEnd，并根据规则判断输赢，增加失败和结束判断，如果跳到空方块或是超过了最大长度值都结束
  onPlayerJumpEnd(moveIndex: number) {
    if (moveIndex < this.roadLength) {
      // 跳到了坑上
      if (this._road[moveIndex] == BlockType.BT_NONE) {
        this.curState = GameState.GS_DIE;
      }
      this._steps = moveIndex;
    } else {
      // 跳过了最大长度
      this.curState = GameState.GS_WIN;
      this._steps = this.roadLength; // 因为在最后一步可能出现步伐大的跳跃，但是此时无论跳跃是步伐大还是步伐小都不应该多增加分数
    }
    this.stepsLabel.string = `Steps: ${this._steps}`;
  }

  // update (deltaTime: number) {
  //   // Your update function goes here.
  // }
}
