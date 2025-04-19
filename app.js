// 全局变量
let map = null;
let marker = null;
let mqttClient = null;
let isConnected = false;

// 在app.js中查找并修改高德地图API密钥
const mapKey = 'f1c66ef729c13e13f2d2645f57b08938';

// 初始化地图
function initMap() {
    try {
        // 创建地图实例
        map = new AMap.Map('map', {
            viewMode: '2D',
            zoom: 12,
            center: [120.123456, 30.123456] // 默认中心位置，可以根据设备的实际位置调整
        });
        
        // 添加地图控件
        map.plugin(['AMap.ToolBar', 'AMap.Scale'], function() {
            // 工具条控件
            map.addControl(new AMap.ToolBar());
            // 比例尺控件
            map.addControl(new AMap.Scale());
        });
        
        console.log("地图初始化完成");

        // 创建标记并设置位置
        marker = new AMap.Marker({
            position: new AMap.LngLat(120.123456, 30.123456),
            title: 'ESP32设备位置',
            map: map,
            // 添加自定义图标
            icon: new AMap.Icon({
                size: new AMap.Size(40, 40),
                image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
                imageSize: new AMap.Size(40, 40)
            })
        });

        // 在适当位置添加调试代码
        console.log('地图已初始化:', !!map);
        console.log('标记已初始化:', !!marker);
        console.log('标记位置:', marker.getPosition());
    } catch (error) {
        console.error('地图初始化失败:', error);
    }
}

// 更新地图标记
function updateMapMarker(longitude, latitude, address) {
    if (!map) {
        console.error("地图未初始化");
        return;
    }

    const position = new AMap.LngLat(longitude, latitude);
    
    if (!marker) {
        // 首次创建标记
        marker = new AMap.Marker({
            position: position,
            title: 'ESP32位置',
            animation: 'AMAP_ANIMATION_DROP'
        });
        marker.setMap(map);
        
        // 添加信息窗体
        const infoWindow = new AMap.InfoWindow({
            content: `<div style="padding:10px;">
                        <h4>ESP32设备</h4>
                        <p>经度: ${longitude}</p>
                        <p>纬度: ${latitude}</p>
                        <p>地址: ${address || '未知'}</p>
                      </div>`,
            offset: new AMap.Pixel(0, -30)
        });
        
        marker.on('click', function() {
            infoWindow.open(map, marker.getPosition());
        });
    } else {
        // 更新已有标记位置
        marker.setPosition(position);
    }
    
    // 移动地图中心到当前位置
    map.setCenter(position);
    console.log("地图标记已更新");
}

// 连接MQTT服务器
function connectMqtt() {
    if (isConnected) {
        console.log('已经连接到MQTT服务器');
        return;
    }
    
    updateConnectionStatus('connecting');
    
    const serverUrl = document.getElementById('mqtt-server').value;
    const port = document.getElementById('mqtt-port').value;
    const mqttTopic = document.getElementById('mqtt-topic').value;
    
    const clientId = 'webClient_' + Math.random().toString(16).substr(2, 8);
    const connectUrl = `ws://${serverUrl}:${port}/mqtt`;
    
    try {
        mqttClient = mqtt.connect(connectUrl, {
            clientId,
            clean: true,
            connectTimeout: 4000,
            reconnectPeriod: 1000
        });
        
        mqttClient.on('connect', function() {
            console.log('MQTT连接成功');
            isConnected = true;
            updateConnectionStatus('connected');
            
            // 订阅主题
            mqttClient.subscribe(mqttTopic, function(err) {
                if (!err) {
                    console.log(`已订阅主题: ${mqttTopic}`);
                } else {
                    console.error('订阅失败:', err);
                }
            });
            
            // 更新按钮状态
            document.getElementById('connect-btn').disabled = true;
            document.getElementById('disconnect-btn').disabled = false;
        });
        
        mqttClient.on('message', function(topic, message) {
            console.log(`收到消息: ${topic} - ${message.toString()}`);
            
            try {
                const data = JSON.parse(message.toString());
                console.log('解析经纬度:', data.longitude, data.latitude);
                
                // 更新UI元素
                document.getElementById('deviceId').textContent = 'ESP32-设备';
                document.getElementById('longitude').textContent = data.longitude.toFixed(6);
                document.getElementById('latitude').textContent = data.latitude.toFixed(6);
                document.getElementById('address').textContent = '定位成功';
                document.getElementById('updateTime').textContent = new Date().toLocaleString();
                
                // 立即调用更新标记位置
                updateMarkerPosition(data.longitude, data.latitude);
                
                // 尝试通过API获取地址信息
                getAddressByLocation(data.longitude, data.latitude);
            } catch (error) {
                console.error('处理消息失败:', error);
            }
        });
        
        mqttClient.on('error', function(err) {
            console.error('MQTT错误:', err);
            updateConnectionStatus('disconnected');
        });
        
        mqttClient.on('close', function() {
            console.log('MQTT连接关闭');
            isConnected = false;
            updateConnectionStatus('disconnected');
            document.getElementById('connect-btn').disabled = false;
            document.getElementById('disconnect-btn').disabled = true;
        });
    } catch (error) {
        console.error('MQTT连接失败:', error);
        updateConnectionStatus('disconnected');
    }
}

// 断开MQTT连接
function disconnectMqtt() {
    if (mqttClient && isConnected) {
        mqttClient.end();
        console.log('已断开MQTT连接');
        isConnected = false;
        updateConnectionStatus('disconnected');
        document.getElementById('connect-btn').disabled = false;
        document.getElementById('disconnect-btn').disabled = true;
    }
}

// 更新连接状态指示器
function updateConnectionStatus(status) {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    statusDot.className = 'status-dot ' + status;
    
    switch(status) {
        case 'connected':
            statusText.textContent = '已连接';
            break;
        case 'disconnected':
            statusText.textContent = '未连接';
            break;
        case 'connecting':
            statusText.textContent = '连接中...';
            break;
    }
}

// 在app.js中添加
function updateMarkerPosition(longitude, latitude) {
  try {
    console.log(`尝试更新标记位置: ${longitude}, ${latitude}`);
    
    if (!map || !marker) {
      console.error('地图或标记未初始化，重新创建');
      // 如果标记不存在，创建新标记
      marker = new AMap.Marker({
        position: new AMap.LngLat(longitude, latitude),
        title: 'ESP32设备',
        map: map
      });
    } else {
      // 更新已有标记位置
      marker.setPosition(new AMap.LngLat(longitude, latitude));
    }
    
    // 将地图中心设置为标记位置
    map.setCenter([longitude, latitude]);
    
    console.log(`标记位置已更新: ${longitude}, ${latitude}`);
  } catch (error) {
    console.error('更新标记位置失败:', error);
  }
}

// 添加getAddressByLocation函数
function getAddressByLocation(lng, lat) {
  try {
    AMap.plugin('AMap.Geocoder', function() {
      var geocoder = new AMap.Geocoder();
      geocoder.getAddress([lng, lat], function(status, result) {
        if (status === 'complete' && result.info === 'OK') {
          // 获取地址成功
          var address = result.regeocode.formattedAddress;
          document.getElementById('address').textContent = address;
          console.log('地址获取成功:', address);
        } else {
          console.error('获取地址失败:', status);
          document.getElementById('address').textContent = '定位成功';
        }
      });
    });
  } catch (error) {
    console.error('调用地址查询失败:', error);
    document.getElementById('address').textContent = '定位成功';
  }
}

// 当文档加载完成时初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM已加载，开始初始化...');
    
    // 初始化地图
    initMap();
    
    // 安全地添加事件监听器
    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', connectMqtt);
        console.log('连接按钮事件已绑定');
    } else {
        console.error('未找到连接按钮元素');
    }
    
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectMqtt);
        console.log('断开按钮事件已绑定');
    } else {
        console.error('未找到断开按钮元素');
    }

    // 添加一个测试按钮手动更新位置
    document.getElementById('test-update-btn').addEventListener('click', function() {
        const testData = {
            longitude: 120.123456,
            latitude: 30.123456
        };
        updateMarkerPosition(testData.longitude, testData.latitude);
        updateDeviceInfo(testData);
    });
});