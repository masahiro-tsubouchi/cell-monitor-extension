from sqlalchemy.orm import declarative_base

# SQLAlchemyのモデル定義のベースとなるクラス
Base = declarative_base()

# 注意: 循環インポートを避けるため、ここではモデルをインポートしない
# 代わりに、main.pyでモデルをインポートしてBase.metadata.create_all()を実行する
