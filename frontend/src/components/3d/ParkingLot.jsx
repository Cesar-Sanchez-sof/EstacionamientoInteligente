import React, { useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';

const ParkingSpace = ({ position, number, statusColor, isTopRow, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const isSelectable = statusColor === 'green' || statusColor === 'yellow';
  const isSelected = statusColor === 'yellow';

  useEffect(() => {
    if (hovered && isSelectable) {
      document.body.style.cursor = 'pointer';
    } else {
      document.body.style.cursor = 'auto';
    }
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered, isSelectable]);

  const getHexColor = (colorStr) => {
    switch (colorStr) {
      case 'green': return '#00ff66';   // Neon green (Available)
      case 'red': return '#ff0055';     // Neon red (Occupied)
      case 'blue': return '#00f3ff';    // Neon cyan (Reserved by user)
      case 'yellow': return '#eab308';  // Neon gold (Selected preview)
      default: return '#555860';
    }
  };

  const targetY = (hovered && isSelectable) ? 0.25 : (isSelected ? 0.1 : 0);
  const backZ = isTopRow ? -2.0 : 2.0;
  const numZ = isTopRow ? 0.9 : -0.9;

  return (
    <group 
      position={[position[0], position[1] + targetY, position[2]]}
      onClick={(e) => {
        if (isSelectable) {
          e.stopPropagation();
          onClick();
        }
      }}
      onPointerEnter={(e) => {
        if (isSelectable) {
          e.stopPropagation();
          setHovered(true);
        }
      }}
      onPointerLeave={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      {/* Piso interior del cajón (Glow del estado) */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[2.04, 0.01, 3.8]} />
        <meshStandardMaterial 
          color={getHexColor(statusColor)} 
          opacity={statusColor === 'yellow' ? 0.95 : 0.45} 
          transparent 
          emissive={getHexColor(statusColor)}
          emissiveIntensity={statusColor === 'yellow' ? 0.6 : (hovered && isSelectable ? 0.4 : 0.25)}
        />
      </mesh>

      {/* Asfalto base del cajón */}
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[2.12, 0.01, 3.92]} />
        <meshStandardMaterial color="#14171d" roughness={0.9} />
      </mesh>
      
      {/* Delimitador de madera izquierdo */}
      <mesh position={[-1.06, 0.06, 0]}>
        <boxGeometry args={[0.08, 0.12, 3.92]} />
        <meshStandardMaterial color="#cdb599" roughness={0.7} />
      </mesh>

      {/* Delimitador de madera derecho */}
      <mesh position={[1.06, 0.06, 0]}>
        <boxGeometry args={[0.08, 0.12, 3.92]} />
        <meshStandardMaterial color="#cdb599" roughness={0.7} />
      </mesh>

      {/* Tope de madera trasero */}
      <mesh position={[0, 0.06, backZ]}>
        <boxGeometry args={[2.2, 0.12, 0.08]} />
        <meshStandardMaterial color="#cdb599" roughness={0.7} />
      </mesh>

      {/* Número en el suelo (lado de la pista) */}
      <Text
        position={[0, 0.025, numZ]}
        rotation={[-Math.PI / 2, 0, isTopRow ? Math.PI : 0]}
        fontSize={0.75}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {number}
      </Text>
    </group>
  );
};

// Componente para pintar las franjas de un paso peatonal (Zebra Crossing)
const ZebraCrossing = ({ position }) => {
  return (
    <group position={position}>
      {[-0.6, -0.3, 0, 0.3, 0.6].map((offsetX, i) => (
        <mesh key={i} position={[offsetX, 0.01, 0]}>
          <boxGeometry args={[0.15, 0.005, 3.2]} />
          <meshBasicMaterial color="#ffffff" opacity={0.85} transparent />
        </mesh>
      ))}
    </group>
  );
};

// Arbustos decorativos en las zonas beige
const Shrub = ({ position }) => {
  return (
    <group position={position}>
      {/* Hojas del arbusto (esferas superpuestas para realismo) */}
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.24, 8, 8]} />
        <meshStandardMaterial color="#2e7d32" roughness={0.9} />
      </mesh>
      <mesh position={[0.1, 0.22, 0.05]}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshStandardMaterial color="#388e3c" roughness={0.9} />
      </mesh>
      <mesh position={[-0.1, 0.2, -0.05]}>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshStandardMaterial color="#1b5e20" roughness={0.9} />
      </mesh>
      {/* Tallo */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.12, 8]} />
        <meshStandardMaterial color="#5d4037" />
      </mesh>
    </group>
  );
};

// Barreras físicas de entrada o salida
const BarrierGate = ({ position, isOpen }) => {
  const rotationZ = isOpen ? -Math.PI / 2 : 0;
  return (
    <group position={position}>
      {/* Poste base de soporte */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.7, 8]} />
        <meshStandardMaterial color="#2d3748" metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Carcasa del motor del servo (naranja) */}
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#dd6b20" metalness={0.5} roughness={0.3} />
      </mesh>
      {/* Brazo Pivotante y Pluma */}
      <group position={[0, 0.75, 0.11]} rotation={[0, 0, rotationZ]}>
        {/* Barra pluma amarilla */}
        <mesh position={[0.7, 0, 0]}>
          <boxGeometry args={[1.4, 0.06, 0.03]} />
          <meshStandardMaterial color="#f6e05e" roughness={0.5} />
        </mesh>
        {/* Franjas negras de precaución */}
        {[-0.5, -0.2, 0.1, 0.4].map((offsetX, i) => (
          <mesh key={i} position={[offsetX + 0.7, 0, 0.016]}>
            <boxGeometry args={[0.1, 0.062, 0.005]} />
            <meshBasicMaterial color="#1a202c" />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const ParkingLot = ({ spaces, onSelectSpace, selectedSpace, barriers = [] }) => {
  const bEntrada = barriers.find(b => b.id_barrera === 1) || { estado: 'CERRADA' };
  const bSalida = barriers.find(b => b.id_barrera === 2) || { estado: 'CERRADA' };
  const isEntradaOpen = bEntrada.estado === 'ABIERTA';
  const isSalidaOpen = bSalida.estado === 'ABIERTA';

  return (
    <div className="w-full h-[520px] rounded-xl overflow-hidden shadow-2xl glass-panel relative border border-gray-800">
      <Canvas camera={{ position: [0, 14, 15], fov: 48 }}>
        <ambientLight intensity={0.65} />
        <pointLight position={[10, 15, 10]} intensity={1.2} />
        <directionalLight position={[-10, 18, -10]} intensity={0.5} castShadow />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2 - 0.05} // No ir por debajo de la maqueta
        />
        
        {/* Tablero Principal (Suelo Maqueta) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[24, 22]} />
          <meshStandardMaterial color="#191c24" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Borde físico de madera/plástico de la maqueta (Marco contenedor) */}
        <group>
          {/* Superior */}
          <mesh position={[0, 0.05, -11]}>
            <boxGeometry args={[24.2, 0.1, 0.2]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Inferior */}
          <mesh position={[0, 0.05, 11]}>
            <boxGeometry args={[24.2, 0.1, 0.2]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Izquierdo */}
          <mesh position={[-12, 0.05, 0]}>
            <boxGeometry args={[0.2, 0.1, 22.2]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Derecho */}
          <mesh position={[12, 0.05, 0]}>
            <boxGeometry args={[0.2, 0.1, 22.2]} />
            <meshStandardMaterial color="#2d3748" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>

        {/* --- MARCA DE AGUA DEL LOGO EN LA CALLE CENTRAL --- */}
        <Text
          position={[0, 0.012, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={2.6}
          color="#ffffff"
          opacity={0.06}
          transparent
          fontWeight="bold"
        >
          PARKFLOW
        </Text>

        {/* --- SEÑALIZACIÓN VIAL CON 2 CARRILES DE CIRCULACIÓN --- */}
        {/* 1. Calle Central (Horizontal, entre las dos filas de cajones) */}
        {[-10.5, -8.0, -5.5, -3.0, -0.5, 2.0, 4.5, 7.0, 9.5, 10.5].map((posX, i) => (
          <mesh key={`mid-dash-${i}`} position={[posX, 0.01, 0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* 2. Pista Inferior (Horizontal, abajo de los cajones 1-5) */}
        {[-10.5, -8.0, -5.5, -3.0, -0.5, 2.0, 4.5, 7.0, 9.5, 10.5].map((posX, i) => (
          <mesh key={`bot-dash-${i}`} position={[posX, 0.01, 8.0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* 3. Pista Superior (Horizontal, arriba de los cajones 6-10) */}
        {[-10.5, -8.0, -5.5, -3.0, -0.5, 2.0, 4.5, 7.0, 9.5, 10.5].map((posX, i) => (
          <mesh key={`top-dash-${i}`} position={[posX, 0.01, -8.0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* 4. Carril Lateral Izquierdo (Vertical) */}
        {[-9.5, -7.0, -4.5, -2.0, 0.5, 3.0, 5.5, 8.0, 9.5].map((posZ, i) => (
          <mesh key={`left-dash-${i}`} position={[-8.0, 0.01, posZ]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}

        {/* 5. Carril Lateral Derecho (Vertical) */}
        {[-9.5, -7.0, -4.5, -2.0, 0.5, 3.0, 5.5, 8.0, 9.5].map((posZ, i) => (
          <mesh key={`right-dash-${i}`} position={[8.0, 0.01, posZ]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.2, 0.005, 0.12]} />
            <meshBasicMaterial color="#ffffff" opacity={0.7} transparent />
          </mesh>
        ))}


        {/* --- PASOS DE CEBRA DE DOS CARRILES (Zona Superior) --- */}
        {/* Entrada (Izquierda) */}
        <ZebraCrossing position={[-4.8, 0, -8.0]} />
        {/* Salida (Derecha) */}
        <ZebraCrossing position={[4.8, 0, -8.0]} />


        {/* --- BARRERAS FÍSICAS DE ENTRADA Y SALIDA (Plumas IoT) --- */}
        {/* Barrera Entrada (Lado izquierdo del paso de cebra de Entrada: x=-6.2, z=-6.2) */}
        <BarrierGate position={[-6.2, 0, -6.2]} isOpen={isEntradaOpen} />

        {/* Barrera Salida (Lado izquierdo del paso de cebra de Salida: x=3.4, z=-6.2) */}
        <BarrierGate position={[3.4, 0, -6.2]} isOpen={isSalidaOpen} />


        {/* --- ZONAS DE INGRESO Y SALIDA (Color #C1AD92 con plantitas 3D) --- */}
        {/* Zona Beige Izquierda */}
        <group>
          <mesh position={[-9.0, 0.008, -8.5]}>
            <boxGeometry args={[4.0, 0.016, 3.0]} />
            <meshStandardMaterial color="#C1AD92" roughness={0.9} />
          </mesh>
          <Shrub position={[-10.2, 0, -9.0]} />
          <Shrub position={[-9.2, 0, -8.2]} />
          <Shrub position={[-8.0, 0, -9.0]} />
          <Shrub position={[-7.4, 0, -7.8]} />
        </group>

        {/* Zona Beige Central */}
        <group>
          <mesh position={[0, 0.008, -8.5]}>
            <boxGeometry args={[5.6, 0.016, 3.0]} />
            <meshStandardMaterial color="#C1AD92" roughness={0.9} />
          </mesh>
          <Shrub position={[-2.2, 0, -9.2]} />
          <Shrub position={[-1.2, 0, -8.0]} />
          <Shrub position={[0, 0, -9.0]} />
          <Shrub position={[1.2, 0, -8.0]} />
          <Shrub position={[2.2, 0, -9.2]} />
        </group>

        {/* Zona Beige Derecha */}
        <group>
          <mesh position={[9.0, 0.008, -8.5]}>
            <boxGeometry args={[4.0, 0.016, 3.0]} />
            <meshStandardMaterial color="#C1AD92" roughness={0.9} />
          </mesh>
          <Shrub position={[7.4, 0, -7.8]} />
          <Shrub position={[8.0, 0, -9.0]} />
          <Shrub position={[9.2, 0, -8.2]} />
          <Shrub position={[10.2, 0, -9.0]} />
        </group>


        {/* --- RENDER DE CAJONES DE ESTACIONAMIENTO --- */}
        {spaces.map((space, index) => {
          const isTopRow = index >= 5; // Cajones 6-10 en fila superior (index 5 a 9)
          const col = index % 5;
          
          // Posiciones con distanciamiento perfecto:
          // X: col * 2.4 - 4.8 (centrado en X=0, espacio lateral cómodo para calles laterales)
          const x = col * 2.4 - 4.8;
          
          // Z: Fila inferior en Z = 4.0, Fila superior en Z = -4.0.
          // Deja una pista central exacta de 4 unidades de ancho (carril de doble sentido)
          const z = isTopRow ? -4.0 : 4.0;

          const isSelected = selectedSpace && selectedSpace.id_lugar === space.id_lugar;
          const finalColor = isSelected ? 'yellow' : space.statusColor;

          return (
            <ParkingSpace
              key={space.id_lugar}
              position={[x, 0, z]}
              number={space.numero}
              statusColor={finalColor}
              isTopRow={isTopRow}
              onClick={() => onSelectSpace(space)}
            />
          );
        })}
      </Canvas>
    </div>
  );
};

export default ParkingLot;
